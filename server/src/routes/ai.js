import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { config } from '../config.js';
import { ah, HttpError, cleanStr, isUuid, resolveToday, round } from '../utils.js';
import { CATEGORIES, CHALLENGE_CATEGORIES } from '../factors.js';
import { computeStats } from '../stats.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.userId,
  message: { error: 'You are asking the AI coach very quickly. Please wait a few minutes.' },
});

// Tried in order. Google retires models and has demand spikes, so we never depend on a single one.
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
const ATTEMPT_TIMEOUT_MS = 20000;
const TOTAL_BUDGET_MS = 50000;
const STICKY_MS = 10 * 60 * 1000;
let lastGood = { model: null, at: 0 };

function modelOrder() {
  const base = [...new Set([config.geminiModel, ...FALLBACK_MODELS])];
  // If the preferred model was busy a moment ago, start with the one that just worked (for a few minutes).
  if (lastGood.model && Date.now() - lastGood.at < STICKY_MS) return [lastGood.model, ...base.filter((m) => m !== lastGood.model)];
  return base;
}

/** Calls Google Gemini from the backend only. The API key never reaches the browser. */
async function callGemini(system, prompt, { json = false } = {}) {
  if (!config.geminiKey) throw new HttpError(503, 'The AI coach is not configured yet.');
  const started = Date.now();
  let lastError = 'unknown error';

  for (const model of modelOrder()) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 3000) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(ATTEMPT_TIMEOUT_MS, remaining));
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, ...(json ? { responseMimeType: 'application/json' } : {}) },
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        lastError = `${model}: ${r.status} ${data?.error?.message || ''}`.slice(0, 300);
        if (r.status === 401 || r.status === 403) break; // bad key - other models will not help
        continue; // retired model (404), busy (503), rate limited (429)... try the next one
      }
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .filter((p) => !p.thought)
        .map((p) => p.text || '')
        .join('')
        .trim();
      if (text) {
        lastGood = { model, at: Date.now() };
        return { text, model };
      }
      lastError = `${model}: empty response`;
    } catch (e) {
      lastError = `${model}: ${e.name === 'AbortError' ? 'timed out' : e.message}`;
    } finally {
      clearTimeout(timer);
    }
  }
  console.error('[ai] Gemini failed -', lastError);
  throw new HttpError(503, 'The AI coach is busy right now. Please try again in a moment.');
}

const COACH = `You are GreenTrack's friendly sustainability coach. You help people measure and reduce their carbon footprint, energy, water and waste.
Rules: base your advice on the user's logged data that is provided; never invent numbers that are not in the data; quantify savings in kg CO2e where you reasonably can and say they are estimates; be practical, positive and specific; keep it concise; reply in clean Markdown using short headings and bullet points; do not use tables.`;

function buildContext(s) {
  const lines = [
    `Name: ${s.name.split(' ')[0] || 'Friend'}`,
    `Date: ${s.today.date}`,
    `Today: ${s.today.kg} kg CO2e. Last 7 days: ${s.week.kg} kg (previous 7 days: ${s.week.prevKg} kg).`,
    `This month so far: ${s.month.kg} kg CO2e from ${s.month.entries} entries. Monthly target: ${s.month.target} kg. Projected month end: ${s.month.projectedKg} kg. Last month: ${s.month.lastMonthKg} kg.`,
    `This month by category: ${s.byCategory.map((c) => `${c.label} ${c.kg} kg`).join(', ') || 'no entries yet'}.`,
    `Biggest sources in the last 30 days: ${s.topActivities.map((t) => `${t.label} ${t.quantity} ${t.unit} = ${t.kg} kg`).join('; ') || 'none logged'}.`,
    `Resources this month: electricity ${s.resources.electricity_kwh} kWh (target ${s.targets.electricity_kwh}), water ${s.resources.water_l} L (target ${s.targets.water_l}), landfill waste ${s.resources.waste_kg} kg (target ${s.targets.waste_kg}), recycled ${s.resources.recycled_kg} kg, composted ${s.resources.composted_kg} kg, recycling rate ${s.resources.recycle_rate}% (goal ${s.targets.recycle_rate}%).`,
    `Habits: ${s.game.streak}-day logging streak, ${s.game.entries} total entries (${s.game.ecoEntries} low-carbon choices), ${s.game.checkins} challenge check-ins.`,
  ];
  return lines.join('\n');
}

const TIPS = {
  commute: ['Swap two car trips a week for metro, bus or cycling - a 10 km petrol car trip emits about 1.9 kg CO₂e, the metro about 0.35 kg.', 'Combine errands into one trip and carpool when you can.'],
  energy: ['Set the AC to 24-26°C and use a fan - each degree higher saves roughly 6% of cooling energy.', 'Switch off appliances at the plug and move remaining bulbs to LED.'],
  food: ['Replace a red-meat meal with a vegetarian one to save about 5.8 kg CO₂e each time.', 'Plan meals for the week to cut food waste.'],
  waste: ['Segregate dry and wet waste at source so more of it can be recycled or composted.', 'Carry a reusable bottle and bag to avoid single-use plastic.'],
  water: ['Shorter showers and a low-flow shower head can save 30-50 L per shower.', 'Fix dripping taps - one drip per second wastes thousands of litres a year.'],
  shopping: ['Buy second-hand or repair before buying new - a new clothing item costs about 12 kg CO₂e.', 'Choose durable, repairable electronics and keep them longer.'],
};

/** Rule-based tips used only when Gemini is unavailable, so the page is never empty. */
function fallbackInsights(s) {
  const out = [];
  if (!s.game.entries) {
    return '### Let’s get started\n- Log a few commutes, meals and your electricity bill so your coach has data to work with.\n- Join a community challenge to earn your first points.';
  }
  out.push('### Your snapshot');
  out.push(`- This month: **${s.month.kg} kg CO₂e** of your **${s.month.target} kg** target (${s.month.pct}%).`);
  out.push(`- At this pace you will finish the month at about **${s.month.projectedKg} kg**.`);
  const ranked = s.byCategory.length ? s.byCategory : [];
  if (ranked.length) out.push(`- Biggest source: **${ranked[0].label}** (${ranked[0].kg} kg).`);
  out.push('### What to do next');
  const keys = ranked.length ? ranked.slice(0, 2).map((c) => c.key) : ['commute', 'energy'];
  for (const k of keys) for (const tip of TIPS[k] || []) out.push(`- ${tip}`);
  if (s.resources.recycle_rate < s.targets.recycle_rate) out.push(`- Your recycling rate is ${s.resources.recycle_rate}% - aim for ${s.targets.recycle_rate}% by sorting dry waste daily.`);
  return out.join('\n');
}

router.post(
  '/generate',
  aiLimiter,
  ah(async (req, res) => {
    const mode = String(req.body?.mode || 'assist');
    const today = resolveToday(req.body?.today);

    /* --- Summarize one logged entry and save the summary on the row --- */
    if (mode === 'summarize') {
      const id = req.body?.item_id;
      if (!isUuid(id)) throw new HttpError(404, 'Entry not found.');
      const [item] = await db.find('items', { eq: { id, user_id: req.userId }, limit: 1 });
      if (!item) throw new HttpError(404, 'Entry not found.');
      const cat = CATEGORIES[item.category];
      const sub = cat?.subtypes[item.subtype];
      const prompt = `Logged activity:\n- Title: ${item.title}\n- Category: ${cat?.label || item.category} / ${sub?.label || item.subtype}\n- Amount: ${item.quantity} ${item.unit}\n- Estimated footprint: ${item.co2_kg} kg CO2e\n- Date: ${item.entry_date}\n- Notes: ${item.description || 'none'}\n\nWrite a 1-2 sentence summary (max 45 words) of this activity's climate impact with one relatable comparison, then one concrete lower-carbon alternative or a short word of praise if it is already a green choice. Plain text only, no Markdown.`;
      const { text, model } = await callGemini(COACH, prompt);
      const [updated] = await db.update('items', { id: item.id, user_id: req.userId }, { ai_summary: text.slice(0, 600) });
      return res.json({ text: updated.ai_summary, item: updated, source: 'gemini', model });
    }

    /* --- Generate a community challenge idea (returns structured fields) --- */
    if (mode === 'challenge_idea') {
      const theme = cleanStr(req.body?.prompt, 200) || 'any everyday sustainability habit';
      const prompt = `Create one fun community sustainability challenge about: "${theme}".\nReturn ONLY JSON with keys: title (max 50 chars), description (max 220 chars, explains what a daily check-in means), category (one of: ${Object.keys(CHALLENGE_CATEGORIES).join(', ')}), duration_days (integer 3-30), co2_per_checkin (realistic estimated kg CO2e saved per person per daily check-in, number 0.1-10), goal_checkins (integer 50-500).`;
      const { text, model } = await callGemini(COACH, prompt, { json: true });
      let idea;
      try {
        idea = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
        if (Array.isArray(idea)) idea = idea[0];
      } catch {
        throw new HttpError(502, 'The AI returned an unexpected answer. Please try again.');
      }
      const clamp = (v, lo, hi, fb) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : fb);
      return res.json({
        source: 'gemini',
        model,
        idea: {
          title: cleanStr(idea?.title, 80) || 'Green Habit Challenge',
          description: cleanStr(idea?.description, 400),
          category: CHALLENGE_CATEGORIES[idea?.category] ? idea.category : 'general',
          duration_days: Math.round(clamp(idea?.duration_days, 1, 365, 7)),
          co2_per_checkin: round(clamp(idea?.co2_per_checkin, 0, 100, 1), 2),
          goal_checkins: Math.round(clamp(idea?.goal_checkins, 1, 100000, 100)),
        },
      });
    }

    if (mode !== 'insights' && mode !== 'assist') throw new HttpError(400, 'Unknown AI mode.');

    const stats = await computeStats(req.userId, today);
    const context = buildContext(stats);

    /* --- Personalised insights from the user's logged data --- */
    if (mode === 'insights') {
      const prompt = `Here is my logged data:\n${context}\n\nGive me personalised insights in under 230 words with exactly these sections:\n### Where you stand\n(2-3 bullets on my footprint versus my target and trend)\n### Top 3 actions\n(3 specific actions ranked by impact for MY biggest sources, each with an estimated kg CO2e saving per week or month)\n### Smart swap\n(one sustainable alternative I could switch to)\n### Keep it up\n(one encouraging sentence)\nIf I have little or no data, say so briefly and suggest what to log first.`;
      try {
        const { text, model } = await callGemini(COACH, prompt);
        return res.json({ text, source: 'gemini', model });
      } catch (e) {
        return res.json({ text: fallbackInsights(stats), source: 'fallback', notice: e.message });
      }
    }

    /* --- Free-form eco assistant --- */
    const question = cleanStr(req.body?.prompt, 1000);
    if (question.length < 2) throw new HttpError(400, 'Please type a question for the coach.');
    const prompt = `My logged data (use it when relevant):\n${context}\n\nMy question: """${question}"""\n\nAnswer in under 200 words. If the question is unrelated to sustainability, the environment or this app, politely steer back to those topics.`;
    const { text, model } = await callGemini(COACH, prompt);
    res.json({ text, source: 'gemini', model });
  })
);

export default router;
