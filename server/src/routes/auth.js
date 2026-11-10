import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { ah, HttpError, cleanStr } from '../utils.js';
import { signToken, requireAuth, publicUser } from '../auth.js';
import { DEFAULT_TARGETS } from '../factors.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PROFILE_COLS = 'id,email,full_name,targets,created_at';

router.post(
  '/signup',
  authLimiter,
  ah(async (req, res) => {
    const email = cleanStr(req.body?.email, 254).toLowerCase();
    const full_name = cleanStr(req.body?.full_name, 80);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!full_name) throw new HttpError(400, 'Please enter your name.');
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
    if (password.length > 72) throw new HttpError(400, 'Password must be 72 characters or fewer.');

    const existing = await db.find('profiles', { eq: { email }, select: 'id', limit: 1 });
    if (existing.length) throw new HttpError(409, 'An account with this email already exists. Try logging in.');

    const password_hash = await bcrypt.hash(password, 10);
    let profile;
    try {
      profile = await db.insert('profiles', {
        id: randomUUID(),
        email,
        full_name,
        password_hash,
        targets: DEFAULT_TARGETS,
      });
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'An account with this email already exists. Try logging in.');
      throw e;
    }
    res.status(201).json({ token: signToken(profile), user: publicUser(profile) });
  })
);

router.post(
  '/login',
  authLimiter,
  ah(async (req, res) => {
    const email = cleanStr(req.body?.email, 254).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) throw new HttpError(400, 'Please enter your email and password.');

    const [profile] = await db.find('profiles', { eq: { email }, limit: 1 });
    const ok = profile ? await bcrypt.compare(password, profile.password_hash) : false;
    if (!ok) throw new HttpError(401, 'Incorrect email or password.');

    res.json({ token: signToken(profile), user: publicUser(profile) });
  })
);

router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const [profile] = await db.find('profiles', { eq: { id: req.userId }, select: PROFILE_COLS, limit: 1 });
    if (!profile) throw new HttpError(401, 'Account not found. Please log in again.');
    res.json({ user: publicUser(profile) });
  })
);

export default router;
