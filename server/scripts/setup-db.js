/**
 * Creates the GreenTrack tables, RLS policies and starter challenges in Supabase.
 * Run with:  npm run setup-db
 *
 * Creating tables needs SQL access, which the service_role key alone does not provide.
 * Set ONE of these in server/.env (only needed for this one-time script):
 *   SUPABASE_ACCESS_TOKEN  - personal access token (sbp_...) from supabase.com/dashboard/account/tokens
 *   SUPABASE_DB_URL        - Postgres connection string from Project Settings -> Database
 */
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const sql = readFileSync(fileURLToPath(new URL('../sql/schema.sql', import.meta.url)), 'utf8');
const url = (process.env.SUPABASE_URL || '').trim();
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const dbUrl = (process.env.SUPABASE_DB_URL || '').trim();

async function viaManagementApi() {
  const ref = new URL(url).hostname.split('.')[0];
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Supabase Management API ${r.status}: ${body.slice(0, 500)}`);
  console.log('Schema applied through the Supabase Management API.');
}

async function viaPostgres() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Schema applied through a direct Postgres connection.');
  } finally {
    await client.end();
  }
}

try {
  if (token && url) await viaManagementApi();
  else if (dbUrl) await viaPostgres();
  else {
    console.error('Missing credentials: set SUPABASE_URL + SUPABASE_ACCESS_TOKEN, or SUPABASE_DB_URL, in server/.env');
    process.exit(1);
  }
  console.log('Done. Tables: profiles, items, challenges, challenge_members (RLS enabled).');
} catch (e) {
  console.error('Database setup failed:', e.message);
  process.exit(1);
}
