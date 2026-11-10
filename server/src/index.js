import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { db, dbMode } from './db.js';
import { ah, HttpError, resolveToday } from './utils.js';
import { requireAuth } from './auth.js';
import { CATEGORIES, CHALLENGE_CATEGORIES, DEFAULT_TARGETS, POINTS, LEVELS } from './factors.js';
import { computeStats } from './stats.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import itemRoutes from './routes/items.js';
import challengeRoutes from './routes/challenges.js';
import aiRoutes from './routes/ai.js';

const app = express();
app.set('trust proxy', 1); // Render / Vercel sit behind a proxy
app.disable('x-powered-by');

app.use(helmet());

/* CORS: in production only the deployed frontend(s) in CLIENT_URL may call the API. */
const allowed = new Set(config.clientUrls);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl, health checks, same-origin
      if (!config.isProd || allowed.has(origin.replace(/\/+$/, ''))) return cb(null, true);
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down a little.' },
  })
);

app.get('/', (req, res) => res.json({ name: 'GreenTrack API', status: 'ok', docs: '/api/health' }));

app.get(
  '/api/health',
  ah(async (req, res) => {
    let database = 'ok';
    if (req.query.deep) {
      try {
        await db.ping();
      } catch (e) {
        database = `error: ${e.message}`;
      }
    }
    res.status(database === 'ok' ? 200 : 503).json({
      ok: database === 'ok',
      db: dbMode,
      database,
      ai: Boolean(config.geminiKey),
      time: new Date().toISOString(),
    });
  })
);

/* Public reference data (emission factors, categories) so the UI and API always agree. */
app.get('/api/meta', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    categories: CATEGORIES,
    challengeCategories: CHALLENGE_CATEGORIES,
    defaultTargets: DEFAULT_TARGETS,
    points: POINTS,
    levels: LEVELS,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', requireAuth, profileRoutes);
app.use('/api/items', requireAuth, itemRoutes);
app.use('/api/challenges', requireAuth, challengeRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.get(
  '/api/stats',
  requireAuth,
  ah(async (req, res) => res.json(await computeStats(req.userId, resolveToday(req.query.today))))
);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (err?.code === '23505') return res.status(409).json({ error: 'That already exists.' });
  if (err?.code === '23503') return res.status(400).json({ error: 'Related record no longer exists. Please refresh and try again.' });
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`GreenTrack API listening on :${config.port} (db: ${dbMode}, ai: ${config.geminiKey ? 'on' : 'off'})`);
  if (dbMode === 'memory') console.warn('[db] No Supabase keys found - using in-memory demo storage (data resets on restart).');
});
