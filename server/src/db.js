/**
 * Tiny data-access layer.
 *  - "supabase" mode: talks to Supabase Postgres with the service_role key (backend only).
 *  - "memory" mode: in-memory store used ONLY for local development when no Supabase keys are set.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import ws from 'ws';
import { config } from './config.js';
import { SEED_CHALLENGES } from './factors.js';

export const dbMode = config.supabaseUrl && config.supabaseServiceKey ? 'supabase' : 'memory';

if (dbMode === 'memory' && config.isProd) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
}

export class DbError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/* --------------------------------- Supabase -------------------------------- */
function createSupabaseDb() {
  const sb = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // supabase-js needs a WebSocket implementation on Node < 22 even though we never open a realtime channel
    realtime: { transport: globalThis.WebSocket || ws },
  });
  const fail = (error) => {
    throw new DbError(error.message || 'Database error', error.code);
  };
  const applyFilters = (q, f) => {
    for (const [k, v] of Object.entries(f.eq || {})) q = q.eq(k, v);
    for (const [k, v] of Object.entries(f.in || {})) q = q.in(k, v);
    for (const [k, v] of Object.entries(f.gte || {})) q = q.gte(k, v);
    for (const [k, v] of Object.entries(f.lte || {})) q = q.lte(k, v);
    return q;
  };

  return {
    async find(table, f = {}) {
      for (const v of Object.values(f.in || {})) if (!v.length) return [];
      const max = f.limit ?? 20000;
      const page = 1000;
      let out = [];
      for (let from = 0; from < max; from += page) {
        const to = Math.min(from + page, max) - 1;
        let q = applyFilters(sb.from(table).select(f.select || '*'), f);
        for (const [col, dir] of f.order || []) q = q.order(col, { ascending: dir !== 'desc' });
        q = q.order('id', { ascending: true }); // stable order for paging
        const { data, error } = await q.range(from, to);
        if (error) fail(error);
        out = out.concat(data);
        if (data.length < to - from + 1) break;
      }
      return out;
    },
    async insert(table, row) {
      const { data, error } = await sb.from(table).insert(row).select().single();
      if (error) fail(error);
      return data;
    },
    async update(table, eq, patch) {
      const { data, error } = await sb.from(table).update(patch).match(eq).select();
      if (error) fail(error);
      return data;
    },
    async remove(table, eq) {
      const { data, error } = await sb.from(table).delete().match(eq).select('id');
      if (error) fail(error);
      return data.length;
    },
    async ping() {
      const { error } = await sb.from('profiles').select('id').limit(1);
      if (error) fail(error);
      return true;
    },
  };
}

/* ---------------------------------- Memory --------------------------------- */
function createMemoryDb() {
  const tables = { profiles: [], items: [], challenges: [], challenge_members: [] };
  const unique = { profiles: [['email']], challenge_members: [['challenge_id', 'user_id']] };
  const clone = (v) => structuredClone(v);
  const cmp = (a, b) => (a === b ? 0 : a === null || a === undefined ? -1 : b === null || b === undefined ? 1 : a < b ? -1 : 1);
  const matches = (row, f) =>
    Object.entries(f.eq || {}).every(([k, v]) => row[k] === v) &&
    Object.entries(f.in || {}).every(([k, v]) => v.includes(row[k])) &&
    Object.entries(f.gte || {}).every(([k, v]) => row[k] >= v) &&
    Object.entries(f.lte || {}).every(([k, v]) => row[k] <= v);
  const checkUnique = (table, row, selfId) => {
    for (const cols of unique[table] || []) {
      const clash = tables[table].some((r) => r.id !== selfId && cols.every((c) => r[c] === row[c]));
      if (clash) throw new DbError('duplicate key value violates unique constraint', '23505');
    }
  };

  for (const c of SEED_CHALLENGES) {
    tables.challenges.push({ id: randomUUID(), ...c, created_by: null, created_at: new Date().toISOString() });
  }

  return {
    async find(table, f = {}) {
      let rows = tables[table].filter((r) => matches(r, f));
      const order = [...(f.order || []), ['id', 'asc']];
      rows.sort((a, b) => {
        for (const [col, dir] of order) {
          const c = cmp(a[col], b[col]);
          if (c) return dir === 'desc' ? -c : c;
        }
        return 0;
      });
      rows = rows.slice(0, f.limit ?? 20000);
      if (f.select && f.select !== '*') {
        const cols = f.select.split(',').map((s) => s.trim());
        rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
      }
      return clone(rows);
    },
    async insert(table, row) {
      const full = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
      checkUnique(table, full, full.id);
      tables[table].push(full);
      return clone(full);
    },
    async update(table, eq, patch) {
      const rows = tables[table].filter((r) => matches(r, { eq }));
      for (const r of rows) {
        checkUnique(table, { ...r, ...patch }, r.id);
        Object.assign(r, patch);
      }
      return clone(rows);
    },
    async remove(table, eq) {
      const before = tables[table].length;
      tables[table] = tables[table].filter((r) => !matches(r, { eq }));
      return before - tables[table].length;
    },
    async ping() {
      return true;
    },
  };
}

export const db = dbMode === 'supabase' ? createSupabaseDb() : createMemoryDb();
