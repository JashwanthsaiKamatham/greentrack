import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { DEFAULT_TARGETS } from './factors.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '30d' });

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

/** Never leak password_hash to the client. */
export const publicUser = (p) => ({
  id: p.id,
  email: p.email,
  full_name: p.full_name || '',
  targets: { ...DEFAULT_TARGETS, ...(p.targets || {}) },
  created_at: p.created_at,
});
