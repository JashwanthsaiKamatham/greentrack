/**
 * End-to-end API smoke test.
 * Usage: API_URL=http://localhost:4000 node scripts/smoke-test.js
 * Creates two throw-away accounts, exercises every route, and checks users cannot touch each other's data.
 */
const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const ORIGIN = process.env.TEST_ORIGIN || '';
const today = new Date().toISOString().slice(0, 10);
let pass = 0, fail = 0;

async function call(method, path, body, token) {
  const r = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(ORIGIN ? { Origin: ORIGIN } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data, headers: r.headers };
}

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

const stamp = Date.now();
const A = { email: `smoke.a.${stamp}@example.com`, password: 'GreenPass#123', full_name: 'Smoke Tester A' };
const B = { email: `smoke.b.${stamp}@example.com`, password: 'GreenPass#456', full_name: 'Smoke Tester B' };

let r = await call('GET', '/health?deep=1');
check('health', r.status === 200 && r.data.ok, JSON.stringify(r.data));
console.log(`       db=${r.data?.db} ai=${r.data?.ai}`);
if (ORIGIN) check('CORS header for origin', r.headers.get('access-control-allow-origin') === ORIGIN, r.headers.get('access-control-allow-origin'));

r = await call('GET', '/meta');
check('meta', r.status === 200 && r.data.categories.commute);

console.log('Auth');
r = await call('POST', '/auth/signup', { ...A, password: 'short' });
check('weak password rejected', r.status === 400);
r = await call('POST', '/auth/signup', { ...A, email: 'not-an-email' });
check('bad email rejected', r.status === 400);
r = await call('POST', '/auth/signup', A);
check('signup A', r.status === 201 && r.data.token && !('password_hash' in r.data.user), JSON.stringify(r.data));
const tokenA1 = r.data?.token;
r = await call('POST', '/auth/signup', { ...A, email: A.email.toUpperCase() });
check('duplicate email rejected', r.status === 409);
r = await call('POST', '/auth/login', { email: A.email, password: 'wrong-password' });
check('wrong password rejected', r.status === 401);
r = await call('POST', '/auth/login', { email: A.email.toUpperCase(), password: A.password });
check('login A (new device)', r.status === 200 && r.data.token);
const tokenA = r.data?.token || tokenA1;
r = await call('GET', '/auth/me', null, tokenA);
check('me', r.status === 200 && r.data.user.email === A.email && !JSON.stringify(r.data).includes('password'));
r = await call('GET', '/auth/me');
check('me without token = 401', r.status === 401);
r = await call('GET', '/items', null, 'bad.token.here');
check('bad token = 401', r.status === 401);
r = await call('POST', '/auth/signup', B);
check('signup B', r.status === 201);
const tokenB = r.data?.token;

console.log('Items CRUD');
r = await call('POST', '/items', { category: 'commute', subtype: 'car_petrol', quantity: 10, entry_date: today, title: 'Drive to office', description: 'Solo trip' }, tokenA);
check('create item', r.status === 201 && Math.abs(r.data.item.co2_kg - 1.92) < 1e-6, JSON.stringify(r.data));
const item = r.data?.item;
r = await call('POST', '/items', { category: 'energy', subtype: 'electricity', quantity: 120, entry_date: today }, tokenA);
check('create electricity bill (default title)', r.status === 201 && r.data.item.title === 'Grid electricity' && Math.abs(r.data.item.co2_kg - 85.2) < 1e-6);
r = await call('POST', '/items', { category: 'waste', subtype: 'recycled', quantity: 3, entry_date: today }, tokenA);
check('create recycling', r.status === 201);
r = await call('POST', '/items', { category: 'commute', subtype: 'nope', quantity: 1, entry_date: today }, tokenA);
check('invalid subtype rejected', r.status === 400);
r = await call('POST', '/items', { category: 'commute', subtype: 'bus', quantity: -4, entry_date: today }, tokenA);
check('negative amount rejected', r.status === 400);
r = await call('POST', '/items', { category: 'commute', subtype: 'bus', quantity: 4, entry_date: '2999-01-01' }, tokenA);
check('future date rejected', r.status === 400);
r = await call('GET', '/items', null, tokenA);
check('list items (3)', r.status === 200 && r.data.items.length === 3);
r = await call('GET', '/items?category=energy', null, tokenA);
check('filter by category', r.status === 200 && r.data.items.length === 1);
r = await call('PUT', `/items/${item.id}`, { category: 'commute', subtype: 'train_metro', quantity: 10, entry_date: today, title: 'Metro to office' }, tokenA);
check('update item', r.status === 200 && r.data.item.title === 'Metro to office' && Math.abs(r.data.item.co2_kg - 0.35) < 1e-6);
r = await call('GET', '/items', null, tokenA);
check('update persisted', r.data.items.some((i) => i.id === item.id && i.subtype === 'train_metro'));

console.log('Isolation between users');
r = await call('GET', '/items', null, tokenB);
check('B sees none of A’s items', r.status === 200 && r.data.items.length === 0);
r = await call('PUT', `/items/${item.id}`, { category: 'commute', subtype: 'bus', quantity: 1, entry_date: today }, tokenB);
check('B cannot edit A’s item', r.status === 404);
r = await call('DELETE', `/items/${item.id}`, null, tokenB);
check('B cannot delete A’s item', r.status === 404);
r = await call('POST', '/ai/generate', { mode: 'summarize', item_id: item.id }, tokenB);
check('B cannot summarize A’s item', r.status === 404);

console.log('Stats and profile');
r = await call('GET', `/stats?today=${today}`, null, tokenA);
check('stats', r.status === 200 && Math.abs(r.data.today.kg - 85.61) < 0.01 && r.data.series.length === 30 && r.data.game.points === 40 && r.data.game.streak === 1 && r.data.resources.electricity_kwh === 120 && r.data.resources.recycle_rate === 100, JSON.stringify({ t: r.data?.today, g: r.data?.game?.points, res: r.data?.resources }));
r = await call('PUT', '/profile', { full_name: 'Smoke A Renamed', targets: { carbon_kg: 180 } }, tokenA);
check('update profile + target', r.status === 200 && r.data.user.targets.carbon_kg === 180 && r.data.user.targets.water_l === 4000 && r.data.user.full_name === 'Smoke A Renamed');
r = await call('PUT', '/profile', { targets: { carbon_kg: -5 } }, tokenA);
check('bad target rejected', r.status === 400);
r = await call('GET', '/auth/me', null, tokenA);
check('profile persisted', r.data.user.targets.carbon_kg === 180);

console.log('Challenges');
r = await call('GET', `/challenges?today=${today}`, null, tokenA);
check('list challenges (seeded)', r.status === 200 && r.data.challenges.length >= 6, `count=${r.data?.challenges?.length}`);
const official = r.data.challenges.find((c) => c.is_official);
r = await call('POST', `/challenges/${official.id}/checkin`, { today }, tokenA);
check('check-in before joining rejected', r.status === 400);
r = await call('POST', `/challenges/${official.id}/join`, null, tokenA);
check('join', r.status === 200);
r = await call('POST', `/challenges/${official.id}/join`, null, tokenA);
check('join twice is harmless', r.status === 200);
r = await call('POST', `/challenges/${official.id}/checkin`, { today }, tokenA);
check('check-in', r.status === 200 && r.data.checkins === 1);
r = await call('POST', `/challenges/${official.id}/checkin`, { today }, tokenA);
check('second check-in same day rejected', r.status === 409);
r = await call('PUT', `/challenges/${official.id}`, { title: 'Hacked', duration_days: 5, co2_per_checkin: 1, goal_checkins: 10 }, tokenA);
check('cannot edit official challenge', r.status === 403);
r = await call('POST', '/challenges', { title: 'Smoke Test Challenge', description: 'temp', category: 'energy', duration_days: 5, co2_per_checkin: 1.5, goal_checkins: 20 }, tokenA);
check('create challenge', r.status === 201);
const mine = r.data?.challenge;
r = await call('PUT', `/challenges/${mine.id}`, { title: 'Smoke Test Challenge v2', description: 'temp', category: 'water', duration_days: 6, co2_per_checkin: 2, goal_checkins: 30 }, tokenA);
check('edit own challenge', r.status === 200 && r.data.challenge.title.endsWith('v2'));
r = await call('DELETE', `/challenges/${mine.id}`, null, tokenB);
check('B cannot delete A’s challenge', r.status === 403);
r = await call('POST', `/challenges/${mine.id}/join`, null, tokenB);
check('B joins A’s challenge', r.status === 200);
r = await call('GET', `/challenges?today=${today}`, null, tokenA);
const c2 = r.data.challenges.find((c) => c.id === mine.id);
const c1 = r.data.challenges.find((c) => c.id === official.id);
check('collective numbers', c2 && c2.members === 2 && c2.is_owner && c1.joined && c1.checked_in_today && c1.my_checkins === 1);
r = await call('GET', '/challenges/leaderboard', null, tokenA);
check('leaderboard', r.status === 200 && r.data.me && r.data.me.points === 60, JSON.stringify(r.data?.me));
r = await call('DELETE', `/challenges/${official.id}/join`, null, tokenA);
check('leave challenge', r.status === 200);
r = await call('DELETE', `/challenges/${mine.id}`, null, tokenA);
check('delete own challenge', r.status === 200);

console.log('AI');
r = await call('POST', '/ai/generate', { mode: 'insights', today }, tokenA);
check('ai insights', r.status === 200 && r.data.text.length > 40, JSON.stringify(r.data).slice(0, 200));
console.log(`       source=${r.data?.source} model=${r.data?.model || '-'}`);
if (process.env.EXPECT_AI) {
  check('insights came from Gemini', r.data.source === 'gemini');
  r = await call('POST', '/ai/generate', { mode: 'summarize', item_id: item.id }, tokenA);
  check('ai summarize saved on item', r.status === 200 && r.data.item.ai_summary?.length > 10, JSON.stringify(r.data).slice(0, 200));
  r = await call('GET', '/items', null, tokenA);
  check('ai summary persisted', Boolean(r.data.items.find((i) => i.id === item.id)?.ai_summary));
  r = await call('POST', '/ai/generate', { mode: 'assist', prompt: 'How can I reduce my electricity footprint?', today }, tokenA);
  check('ai assist', r.status === 200 && r.data.text.length > 40, JSON.stringify(r.data).slice(0, 200));
  r = await call('POST', '/ai/generate', { mode: 'challenge_idea', prompt: 'cycling to college' }, tokenA);
  check('ai challenge idea', r.status === 200 && r.data.idea.title.length > 2, JSON.stringify(r.data).slice(0, 200));
}
r = await call('POST', '/ai/generate', { mode: 'assist', prompt: '' }, tokenA);
check('empty AI prompt rejected', r.status === 400);

console.log('Cleanup');
r = await call('GET', '/items', null, tokenA);
for (const it of r.data.items) await call('DELETE', `/items/${it.id}`, null, tokenA);
r = await call('GET', '/items', null, tokenA);
check('delete items', r.data.items.length === 0);
r = await call('DELETE', `/items/${item.id}`, null, tokenA);
check('delete again = 404', r.status === 404);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Test accounts created: ${A.email}, ${B.email}`);
process.exit(fail ? 1 : 0);
