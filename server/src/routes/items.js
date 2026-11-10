import { Router } from 'express';
import { db } from '../db.js';
import { ah, HttpError, cleanStr, round, isDate, isUuid, addDays, utcToday } from '../utils.js';
import { CATEGORIES } from '../factors.js';

const router = Router();

function parseEntry(body) {
  const category = String(body?.category || '');
  const cat = CATEGORIES[category];
  if (!cat) throw new HttpError(400, 'Please choose a valid category.');

  const subtype = String(body?.subtype || '');
  const sub = cat.subtypes[subtype];
  if (!sub) throw new HttpError(400, 'Please choose a valid activity type.');

  const quantity = Number(body?.quantity);
  if (body?.quantity === '' || body?.quantity === null || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    throw new HttpError(400, 'Amount must be a number greater than 0.');
  }

  const entry_date = body?.entry_date;
  if (!isDate(entry_date) || entry_date < '2000-01-01' || entry_date > addDays(utcToday(), 1)) {
    throw new HttpError(400, 'Please pick a valid date (not in the future).');
  }

  return {
    category,
    subtype,
    quantity: round(quantity, 3),
    unit: sub.unit,
    co2_kg: round(quantity * sub.factor, 3),
    entry_date,
    title: cleanStr(body?.title, 120) || sub.label,
    description: cleanStr(body?.description, 500) || null,
  };
}

router.get(
  '/',
  ah(async (req, res) => {
    const f = { eq: { user_id: req.userId }, gte: {}, lte: {}, order: [['entry_date', 'desc'], ['created_at', 'desc']] };
    const { category, from, to } = req.query;
    if (category) {
      if (!CATEGORIES[category]) throw new HttpError(400, 'Unknown category.');
      f.eq.category = category;
    }
    if (from) {
      if (!isDate(from)) throw new HttpError(400, 'Invalid "from" date.');
      f.gte.entry_date = from;
    }
    if (to) {
      if (!isDate(to)) throw new HttpError(400, 'Invalid "to" date.');
      f.lte.entry_date = to;
    }
    const limit = Number.parseInt(req.query.limit, 10);
    f.limit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 300;
    res.json({ items: await db.find('items', f) });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const entry = parseEntry(req.body);
    const item = await db.insert('items', { user_id: req.userId, ...entry, ai_summary: null });
    res.status(201).json({ item });
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Entry not found.');
    const entry = parseEntry(req.body);
    // ai_summary is cleared because the old summary no longer matches the edited entry
    const rows = await db.update('items', { id: req.params.id, user_id: req.userId }, { ...entry, ai_summary: null });
    if (!rows.length) throw new HttpError(404, 'Entry not found.');
    res.json({ item: rows[0] });
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Entry not found.');
    const n = await db.remove('items', { id: req.params.id, user_id: req.userId });
    if (!n) throw new HttpError(404, 'Entry not found.');
    res.json({ ok: true });
  })
);

export default router;
