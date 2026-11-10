import { Router } from 'express';
import { db } from '../db.js';
import { ah, HttpError, cleanStr, round } from '../utils.js';
import { publicUser } from '../auth.js';
import { DEFAULT_TARGETS } from '../factors.js';

const router = Router();
const PROFILE_COLS = 'id,email,full_name,targets,created_at';

router.put(
  '/',
  ah(async (req, res) => {
    const [current] = await db.find('profiles', { eq: { id: req.userId }, select: PROFILE_COLS, limit: 1 });
    if (!current) throw new HttpError(401, 'Account not found. Please log in again.');

    const patch = {};
    if (req.body?.full_name !== undefined) {
      const full_name = cleanStr(req.body.full_name, 80);
      if (!full_name) throw new HttpError(400, 'Name cannot be empty.');
      patch.full_name = full_name;
    }
    if (req.body?.targets !== undefined) {
      const incoming = req.body.targets || {};
      const targets = { ...DEFAULT_TARGETS, ...(current.targets || {}) };
      for (const key of Object.keys(DEFAULT_TARGETS)) {
        if (incoming[key] === undefined) continue;
        const n = Number(incoming[key]);
        const max = key === 'recycle_rate' ? 100 : 1_000_000;
        if (!Number.isFinite(n) || n <= 0 || n > max) {
          throw new HttpError(400, key === 'recycle_rate' ? 'Recycling goal must be between 1 and 100%.' : 'Targets must be numbers greater than 0.');
        }
        targets[key] = round(n, 1);
      }
      patch.targets = targets;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update.');

    const [updated] = await db.update('profiles', { id: req.userId }, patch);
    res.json({ user: publicUser(updated) });
  })
);

export default router;
