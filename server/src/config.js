import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const env = process.env;
const clean = (v) => (v || '').trim();

export const config = {
  port: Number(env.PORT) || 4000,
  isProd: env.NODE_ENV === 'production',
  jwtSecret: clean(env.JWT_SECRET),
  supabaseUrl: clean(env.SUPABASE_URL).replace(/\/+$/, ''),
  supabaseAnonKey: clean(env.SUPABASE_ANON_KEY),
  supabaseServiceKey: clean(env.SUPABASE_SERVICE_ROLE_KEY),
  geminiKey: clean(env.GEMINI_API_KEY),
  geminiModel: clean(env.GEMINI_MODEL) || 'gemini-2.5-flash',
  clientUrls: clean(env.CLIENT_URL)
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
};

if (!config.jwtSecret) {
  if (config.isProd) throw new Error('JWT_SECRET is required in production.');
  config.jwtSecret = randomBytes(32).toString('hex');
  console.warn('[config] JWT_SECRET not set - using a temporary one (sessions reset on restart).');
}
