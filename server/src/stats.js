import { db } from './db.js';
import { HttpError, addDays, shiftMonth, daysInMonth, round } from './utils.js';
import { CATEGORIES, DEFAULT_TARGETS, LEVELS, calcPoints, isEco } from './factors.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function resourceKey(it) {
  if (it.category === 'energy' && it.subtype === 'electricity') return 'electricity_kwh';
  if (it.category === 'water') return 'water_l';
  if (it.category === 'waste') {
    if (it.subtype === 'landfill') return 'waste_kg';
    if (it.subtype === 'recycled') return 'recycled_kg';
    if (it.subtype === 'composted') return 'composted_kg';
  }
  return null;
}

const emptyResources = () => ({ electricity_kwh: 0, water_l: 0, waste_kg: 0, recycled_kg: 0, composted_kg: 0 });

const recycleRate = (r) => {
  const total = r.waste_kg + r.recycled_kg + r.composted_kg;
  return total > 0 ? round(((r.recycled_kg + r.composted_kg) / total) * 100, 0) : 0;
};

export function levelInfo(points) {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (points >= l.at) idx = i;
  });
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  return {
    level: idx + 1,
    levelName: cur.name,
    nextLevelName: next ? next.name : null,
    nextLevelAt: next ? next.at : null,
    levelProgressPct: next ? Math.min(100, round(((points - cur.at) / (next.at - cur.at)) * 100, 0)) : 100,
  };
}

/** Everything the dashboard, resources page, profile and AI coach need - computed from the user's own rows. */
export async function computeStats(userId, today) {
  const [profile] = await db.find('profiles', { eq: { id: userId }, select: 'id,full_name,targets', limit: 1 });
  if (!profile) throw new HttpError(401, 'Account not found. Please log in again.');
  const targets = { ...DEFAULT_TARGETS, ...(profile.targets || {}) };

  const [items, memberships] = await Promise.all([
    db.find('items', { eq: { user_id: userId }, select: 'entry_date,category,subtype,quantity,co2_kg' }),
    db.find('challenge_members', { eq: { user_id: userId }, select: 'challenge_id,checkins' }),
  ]);
  const challengeIds = memberships.map((m) => m.challenge_id);
  const challenges = challengeIds.length
    ? await db.find('challenges', { in: { id: challengeIds }, select: 'id,co2_per_checkin' })
    : [];

  const monthKey = today.slice(0, 7);
  const lastMonthKey = shiftMonth(monthKey, -1);
  const yesterday = addDays(today, -1);
  const d7 = addDays(today, -6);
  const d14 = addDays(today, -13);
  const d30 = addDays(today, -29);

  const dayTotals = new Map();
  const days = new Set();
  const byCat = {};
  const top = new Map();
  const resources = emptyResources();
  const history = new Map();
  for (let i = 5; i >= 0; i--) {
    const key = shiftMonth(monthKey, -i);
    history.set(key, { month: key, label: MONTH_NAMES[Number(key.slice(5)) - 1], co2: 0, ...emptyResources() });
  }

  let monthKg = 0, lastMonthKg = 0, todayKg = 0, yesterdayKg = 0, weekKg = 0, prevWeekKg = 0, eco = 0, monthEntries = 0;

  for (const it of items) {
    const kg = Number(it.co2_kg) || 0;
    const qty = Number(it.quantity) || 0;
    const d = it.entry_date;
    const mk = d.slice(0, 7);
    const rKey = resourceKey(it);

    days.add(d);
    if (isEco(it.category, it.subtype)) eco++;
    dayTotals.set(d, (dayTotals.get(d) || 0) + kg);

    if (mk === monthKey) {
      monthKg += kg;
      monthEntries++;
      byCat[it.category] = (byCat[it.category] || 0) + kg;
      if (rKey) resources[rKey] += qty;
    }
    if (mk === lastMonthKey) lastMonthKg += kg;
    if (d === today) todayKg += kg;
    if (d === yesterday) yesterdayKg += kg;
    if (d >= d7 && d <= today) weekKg += kg;
    else if (d >= d14 && d < d7) prevWeekKg += kg;

    if (d >= d30 && d <= today) {
      const k = `${it.category}:${it.subtype}`;
      const sub = CATEGORIES[it.category]?.subtypes[it.subtype];
      const t = top.get(k) || { category: it.category, subtype: it.subtype, label: sub?.label || it.subtype, unit: sub?.unit || '', quantity: 0, kg: 0 };
      t.quantity += qty;
      t.kg += kg;
      top.set(k, t);
    }

    const h = history.get(mk);
    if (h) {
      h.co2 += kg;
      if (rKey) h[rKey] += qty;
    }
  }

  const series = [];
  for (let i = 29; i >= 0; i--) {
    const date = addDays(today, -i);
    series.push({ date, kg: round(dayTotals.get(date) || 0, 2) });
  }

  let streak = 0;
  let cursor = days.has(today) ? today : yesterday;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const co2ByChallenge = new Map(challenges.map((c) => [c.id, Number(c.co2_per_checkin) || 0]));
  let checkins = 0, savedKg = 0;
  for (const m of memberships) {
    const n = Number(m.checkins) || 0;
    checkins += n;
    savedKg += n * (co2ByChallenge.get(m.challenge_id) || 0);
  }

  const entries = items.length;
  const points = calcPoints({ entries, eco, checkins });
  const dayOfMonth = Number(today.slice(8));
  const projectedKg = dayOfMonth > 0 ? (monthKg / dayOfMonth) * daysInMonth(monthKey) : monthKg;
  const greenCommutes = items.filter((it) => it.category === 'commute' && isEco(it.category, it.subtype)).length;
  const totalRecycled = items.reduce(
    (s, it) => s + (it.category === 'waste' && it.subtype !== 'landfill' ? Number(it.quantity) || 0 : 0),
    0
  );

  const badges = [
    { key: 'first_step', emoji: '🌱', label: 'First Step', desc: 'Log your first activity', earned: entries >= 1 },
    { key: 'week_warrior', emoji: '🔥', label: 'Week Warrior', desc: 'Keep a 7-day logging streak', earned: streak >= 7 },
    { key: 'green_commuter', emoji: '🚲', label: 'Green Commuter', desc: 'Log 10 low-carbon trips', earned: greenCommutes >= 10 },
    { key: 'recycler', emoji: '♻️', label: 'Recycling Hero', desc: 'Recycle or compost 10 kg', earned: totalRecycled >= 10 },
    { key: 'team_player', emoji: '🤝', label: 'Team Player', desc: 'Join a community challenge', earned: memberships.length >= 1 },
    { key: 'champion', emoji: '🏆', label: 'Challenge Champion', desc: 'Complete 10 challenge check-ins', earned: checkins >= 10 },
    { key: 'on_budget', emoji: '🎯', label: 'On Budget', desc: 'Finish a month under your carbon target', earned: lastMonthKg > 0 && lastMonthKg <= targets.carbon_kg },
    { key: 'centurion', emoji: '💯', label: 'Centurion', desc: 'Log 100 activities', earned: entries >= 100 },
  ];

  return {
    name: profile.full_name || '',
    targets,
    today: { date: today, kg: round(todayKg), yesterdayKg: round(yesterdayKg) },
    week: {
      kg: round(weekKg),
      prevKg: round(prevWeekKg),
      changePct: prevWeekKg > 0 ? round(((weekKg - prevWeekKg) / prevWeekKg) * 100, 0) : null,
    },
    month: {
      key: monthKey,
      kg: round(monthKg),
      entries: monthEntries,
      lastMonthKg: round(lastMonthKg),
      target: targets.carbon_kg,
      pct: round((monthKg / targets.carbon_kg) * 100, 0),
      projectedKg: round(projectedKg),
    },
    series,
    byCategory: Object.entries(CATEGORIES)
      .map(([key, c]) => ({ key, label: c.label, color: c.color, kg: round(byCat[key] || 0) }))
      .filter((c) => c.kg > 0)
      .sort((a, b) => b.kg - a.kg),
    topActivities: [...top.values()]
      .map((t) => ({ ...t, quantity: round(t.quantity), kg: round(t.kg) }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 6),
    resources: {
      ...Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, round(v)])),
      recycle_rate: recycleRate(resources),
    },
    history: [...history.values()].map((h) => ({
      month: h.month,
      label: h.label,
      co2: round(h.co2),
      electricity_kwh: round(h.electricity_kwh),
      water_l: round(h.water_l),
      waste_kg: round(h.waste_kg),
      recycled_kg: round(h.recycled_kg + h.composted_kg),
    })),
    game: {
      points,
      ...levelInfo(points),
      streak,
      entries,
      ecoEntries: eco,
      checkins,
      challengesJoined: memberships.length,
      savedKg: round(savedKg),
      badges,
    },
  };
}
