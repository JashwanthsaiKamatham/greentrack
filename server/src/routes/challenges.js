import { Router } from 'express';
import { db } from '../db.js';
import { ah, HttpError, cleanStr, round, isUuid, resolveToday } from '../utils.js';
import { CHALLENGE_CATEGORIES, calcPoints, isEco } from '../factors.js';
import { levelInfo } from '../stats.js';

const router = Router();

function parseChallenge(body) {
  const title = cleanStr(body?.title, 80);
  if (title.length < 3) throw new HttpError(400, 'Title must be at least 3 characters.');
  const description = cleanStr(body?.description, 400);
  const category = CHALLENGE_CATEGORIES[body?.category] ? body.category : 'general';

  const duration_days = Number(body?.duration_days);
  if (!Number.isInteger(duration_days) || duration_days < 1 || duration_days > 365) {
    throw new HttpError(400, 'Duration must be between 1 and 365 days.');
  }
  const co2_per_checkin = Number(body?.co2_per_checkin);
  if (!Number.isFinite(co2_per_checkin) || co2_per_checkin < 0 || co2_per_checkin > 100) {
    throw new HttpError(400, 'CO₂ saved per check-in must be between 0 and 100 kg.');
  }
  const goal_checkins = Number(body?.goal_checkins);
  if (!Number.isInteger(goal_checkins) || goal_checkins < 1 || goal_checkins > 100000) {
    throw new HttpError(400, 'Community goal must be between 1 and 100,000 check-ins.');
  }
  return { title, description, category, duration_days, co2_per_checkin: round(co2_per_checkin, 2), goal_checkins };
}

async function getChallenge(id) {
  if (!isUuid(id)) throw new HttpError(404, 'Challenge not found.');
  const [c] = await db.find('challenges', { eq: { id }, limit: 1 });
  if (!c) throw new HttpError(404, 'Challenge not found.');
  return c;
}

const shortName = (full) => {
  const parts = String(full || 'Eco friend').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

router.get(
  '/',
  ah(async (req, res) => {
    const today = resolveToday(req.query.today);
    const [challenges, members] = await Promise.all([
      db.find('challenges', { order: [['created_at', 'asc']], limit: 500 }),
      db.find('challenge_members', { select: 'challenge_id,user_id,checkins,last_checkin' }),
    ]);

    const agg = new Map();
    for (const m of members) {
      const a = agg.get(m.challenge_id) || { members: 0, total: 0, mine: null };
      a.members++;
      a.total += Number(m.checkins) || 0;
      if (m.user_id === req.userId) a.mine = m;
      agg.set(m.challenge_id, a);
    }

    let communityCheckins = 0, communitySaved = 0;
    const list = challenges.map((c) => {
      const a = agg.get(c.id) || { members: 0, total: 0, mine: null };
      const co2 = Number(c.co2_per_checkin) || 0;
      communityCheckins += a.total;
      communitySaved += a.total * co2;
      return {
        id: c.id,
        title: c.title,
        description: c.description || '',
        category: c.category,
        duration_days: c.duration_days,
        co2_per_checkin: co2,
        goal_checkins: c.goal_checkins,
        created_at: c.created_at,
        members: a.members,
        total_checkins: a.total,
        co2_saved: round(a.total * co2, 1),
        progress_pct: Math.min(100, round((a.total / Math.max(1, c.goal_checkins)) * 100, 0)),
        joined: Boolean(a.mine),
        my_checkins: a.mine ? Number(a.mine.checkins) || 0 : 0,
        checked_in_today: Boolean(a.mine && a.mine.last_checkin === today),
        is_owner: c.created_by === req.userId,
        is_official: !c.created_by,
      };
    });

    res.json({
      challenges: list,
      community: {
        participants: new Set(members.map((m) => m.user_id)).size,
        checkins: communityCheckins,
        co2_saved: round(communitySaved, 1),
      },
    });
  })
);

router.get(
  '/leaderboard',
  ah(async (req, res) => {
    const [profiles, items, members] = await Promise.all([
      db.find('profiles', { select: 'id,full_name', limit: 2000 }),
      db.find('items', { select: 'user_id,category,subtype', limit: 50000 }),
      db.find('challenge_members', { select: 'user_id,checkins' }),
    ]);
    const tally = new Map(profiles.map((p) => [p.id, { id: p.id, name: shortName(p.full_name), entries: 0, eco: 0, checkins: 0 }]));
    for (const it of items) {
      const t = tally.get(it.user_id);
      if (!t) continue;
      t.entries++;
      if (isEco(it.category, it.subtype)) t.eco++;
    }
    for (const m of members) {
      const t = tally.get(m.user_id);
      if (t) t.checkins += Number(m.checkins) || 0;
    }
    const ranked = [...tally.values()]
      .map((t) => {
        const points = calcPoints(t);
        return { name: t.name, points, checkins: t.checkins, levelName: levelInfo(points).levelName, isMe: t.id === req.userId };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((t, i) => ({ rank: i + 1, ...t }));

    res.json({ top: ranked.slice(0, 10), me: ranked.find((r) => r.isMe) || null, total: ranked.length });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const data = parseChallenge(req.body);
    const challenge = await db.insert('challenges', { ...data, created_by: req.userId });
    // the creator automatically joins their own challenge
    await db.insert('challenge_members', { challenge_id: challenge.id, user_id: req.userId, checkins: 0, last_checkin: null });
    res.status(201).json({ challenge });
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const c = await getChallenge(req.params.id);
    if (c.created_by !== req.userId) throw new HttpError(403, 'Only the creator can edit this challenge.');
    const [challenge] = await db.update('challenges', { id: c.id }, parseChallenge(req.body));
    res.json({ challenge });
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const c = await getChallenge(req.params.id);
    if (c.created_by !== req.userId) throw new HttpError(403, 'Only the creator can delete this challenge.');
    await db.remove('challenge_members', { challenge_id: c.id });
    await db.remove('challenges', { id: c.id });
    res.json({ ok: true });
  })
);

router.post(
  '/:id/join',
  ah(async (req, res) => {
    const c = await getChallenge(req.params.id);
    const existing = await db.find('challenge_members', { eq: { challenge_id: c.id, user_id: req.userId }, limit: 1 });
    if (!existing.length) {
      try {
        await db.insert('challenge_members', { challenge_id: c.id, user_id: req.userId, checkins: 0, last_checkin: null });
      } catch (e) {
        if (e.code !== '23505') throw e; // already joined from another tab/device - that's fine
      }
    }
    res.json({ ok: true });
  })
);

router.delete(
  '/:id/join',
  ah(async (req, res) => {
    const c = await getChallenge(req.params.id);
    await db.remove('challenge_members', { challenge_id: c.id, user_id: req.userId });
    res.json({ ok: true });
  })
);

router.post(
  '/:id/checkin',
  ah(async (req, res) => {
    const c = await getChallenge(req.params.id);
    const today = resolveToday(req.body?.today);
    const [m] = await db.find('challenge_members', { eq: { challenge_id: c.id, user_id: req.userId }, limit: 1 });
    if (!m) throw new HttpError(400, 'Join this challenge first.');
    if (m.last_checkin && m.last_checkin >= today) throw new HttpError(409, 'You already checked in today. Come back tomorrow!');
    const [updated] = await db.update('challenge_members', { id: m.id }, { checkins: (Number(m.checkins) || 0) + 1, last_checkin: today });
    res.json({ ok: true, checkins: updated.checkins });
  })
);

export default router;
