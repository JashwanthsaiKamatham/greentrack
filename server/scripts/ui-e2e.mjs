import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:5173';
// Where the API lives. Empty = same origin as the page (local). Set to the Render URL when testing production.
const API_BASE = (process.env.API_BASE || '').replace(/\/+$/, '');
const shots = '/tmp/pw/shots';
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) errors.push(`[http ${r.status()}] ${r.request().method()} ${r.url()}`); });
const step = (s) => console.log('>', s);
const email = `ui.${Date.now()}@example.com`;
const pw = 'GreenPass#123';

step('auth page');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForURL('**/auth');
await page.screenshot({ path: `${shots}/01-auth-desktop.png` });

step('validation error');
await page.getByRole('tab', { name: 'Sign up' }).click();
await page.getByRole('button', { name: 'Create account' }).click();
await page.getByText('Please enter your name.').waitFor();

step('sign up');
await page.getByLabel('Full name').fill('Asha Kumar');
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password', { exact: true }).fill(pw);
await page.getByRole('button', { name: 'Create account' }).click();
await page.getByText(/Good (morning|afternoon|evening), Asha/).waitFor();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${shots}/02-dashboard-empty.png`, fullPage: true });

step('add entry through the form');
await page.getByRole('button', { name: 'Log activity' }).click();
await page.getByRole('dialog').waitFor();
await page.getByLabel('Amount (km)').fill('12');
await page.getByLabel('Title (optional)').fill('Drive to office');
await page.screenshot({ path: `${shots}/03-entry-form.png` });
await page.getByRole('button', { name: 'Save entry' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.getByText('Drive to office').first().waitFor();

step('seed more data through the API');
await page.evaluate(async (apiBase) => {
  const token = localStorage.getItem('gt_token');
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const rows = [
    ['energy', 'electricity', 42, 0], ['food', 'meal_vegetarian', 2, 0], ['water', 'tap', 180, 0], ['waste', 'recycled', 1.5, 0],
    ['commute', 'train_metro', 18, 1], ['food', 'meal_chicken_fish', 1, 1], ['waste', 'landfill', 2, 1], ['energy', 'electricity', 30, 1],
    ['commute', 'car_petrol', 25, 2], ['food', 'meal_red_meat', 1, 2], ['water', 'tap', 220, 2],
    ['commute', 'bicycle', 6, 3], ['energy', 'lpg', 1.2, 3], ['shopping', 'clothing', 1, 4], ['commute', 'bus', 14, 5],
    ['energy', 'electricity', 38, 6], ['waste', 'composted', 1, 6], ['commute', 'car_petrol', 30, 9], ['food', 'meal_vegan', 3, 10],
    ['energy', 'electricity', 110, 35], ['water', 'tap', 3200, 40], ['waste', 'landfill', 9, 38], ['energy', 'electricity', 140, 65], ['water', 'tap', 3900, 70],
  ];
  for (const [category, subtype, quantity, ago] of rows) {
    const r = await fetch(apiBase + '/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ category, subtype, quantity, entry_date: d(ago) }) });
    if (!r.ok) throw new Error('seed failed ' + r.status);
  }
}, API_BASE);

step('refresh keeps the session and data');
await page.reload({ waitUntil: 'networkidle' });
await page.getByText(/Good (morning|afternoon|evening), Asha/).waitFor();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${shots}/04-dashboard.png`, fullPage: true });

step('tracker: edit + delete');
await page.getByRole('link', { name: 'Carbon Tracker' }).click();
await page.getByRole('heading', { name: 'Carbon Tracker' }).waitFor();
await page.getByText('Drive to office').waitFor();
await page.screenshot({ path: `${shots}/05-tracker.png`, fullPage: false });
await page.getByRole('button', { name: 'Edit entry' }).first().click();
await page.getByRole('dialog').waitFor();
await page.getByLabel('Title (optional)').fill('Edited title entry');
await page.getByRole('button', { name: 'Save changes' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.getByText('Edited title entry').waitFor();
const before = await page.getByRole('button', { name: 'Delete entry' }).count();
await page.getByRole('button', { name: 'Delete entry' }).first().click();
await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.waitForFunction((n) => document.querySelectorAll('button[aria-label="Delete entry"]').length === n - 1, before);
await page.getByPlaceholder('Search your entries…').fill('metro');
await page.getByText('1 entry').waitFor();
await page.getByPlaceholder('Search your entries…').fill('');
await page.getByRole('button', { name: 'Food' }).click();
await page.waitForTimeout(300);

step('resources');
await page.getByRole('link', { name: 'Resources' }).click();
await page.getByRole('heading', { name: 'Smart Resource Logger' }).waitFor();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/06-resources.png`, fullPage: true });
await page.getByRole('button', { name: 'Log bill' }).click();
await page.getByLabel('Amount (kWh)').fill('20');
await page.getByRole('button', { name: 'Save entry' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.getByRole('button', { name: 'Set targets' }).click();
await page.getByLabel('Electricity (kWh / month)').fill('180');
await page.getByRole('button', { name: 'Save targets' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.getByText('of 180 kWh').waitFor();
await page.getByRole('button', { name: 'Water', exact: true }).click();

step('challenges');
await page.getByRole('link', { name: 'Challenges' }).click();
await page.getByRole('heading', { name: 'Eco-Action Challenges' }).waitFor();
await page.getByRole('button', { name: 'Join challenge' }).first().click();
await page.getByRole('button', { name: 'Check in today' }).first().click();
await page.getByRole('button', { name: 'Checked in today' }).first().waitFor();
await page.getByRole('button', { name: 'New challenge' }).click();
await page.getByLabel('Title').fill('Stairs not lifts');
await page.getByLabel('Description').fill('Take the stairs all day and check in.');
await page.getByRole('button', { name: 'Create challenge' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.getByText('Stairs not lifts').waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/07-challenges.png`, fullPage: true });
await page.getByRole('button', { name: 'Edit challenge' }).click();
await page.getByLabel('Title').fill('Stairs not lifts week');
await page.getByRole('button', { name: 'Save changes' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.getByText('Stairs not lifts week').waitFor();
await page.getByRole('button', { name: 'Leaderboard' }).click();
await page.getByText('Community leaderboard').waitFor();
await page.screenshot({ path: `${shots}/08-leaderboard.png` });
await page.getByRole('button', { name: /All challenges/ }).click();
await page.getByRole('button', { name: 'Delete challenge' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
await page.getByText('Stairs not lifts week').waitFor({ state: 'detached' });

step('insights');
await page.getByRole('link', { name: 'AI Insights' }).click();
await page.getByRole('button', { name: 'Generate my insights' }).click();
await page.getByText(/Generated /).waitFor({ timeout: 60000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${shots}/09-insights.png`, fullPage: true });

step('profile');
await page.getByRole('link', { name: /Asha Kumar/ }).click();
await page.getByRole('heading', { name: 'Profile' }).waitFor();
await page.getByLabel('Monthly carbon target (kg CO₂e)').fill('250');
await page.getByRole('button', { name: 'Save changes' }).click();
await page.getByText('Profile saved').waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/10-profile.png`, fullPage: true });

step('mobile views');
await page.setViewportSize({ width: 390, height: 844 });
for (const [path, name] of [['/', 'dashboard'], ['/tracker', 'tracker'], ['/resources', 'resources'], ['/challenges', 'challenges'], ['/insights', 'insights'], ['/profile', 'profile']]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${shots}/m-${name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) errors.push(`[layout] horizontal overflow of ${overflow}px on mobile ${path}`);
}
await page.goto(BASE + '/tracker', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Add entry' }).click();
await page.getByRole('dialog').waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}/m-entry-form.png` });
await page.keyboard.press('Escape');

step('log out and log back in');
await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Log out' }).click();
await page.waitForURL('**/auth');
await page.waitForTimeout(700);
await page.screenshot({ path: `${shots}/m-auth.png`, fullPage: true });
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password', { exact: true }).fill('wrong-password');
await page.getByRole('button', { name: 'Log in' }).last().click();
await page.getByText('Incorrect email or password.').waitFor();
await page.getByLabel('Password', { exact: true }).fill(pw);
await page.getByRole('button', { name: 'Log in' }).last().click();
await page.getByText(/Good (morning|afternoon|evening), Asha/).waitFor();

await browser.close();
const expected = (e) => e.includes('[http 401]') && e.includes('/auth/login') || e.includes('Failed to load resource: the server responded with a status of 401');
const real = errors.filter((e) => !expected(e));
console.log(real.length ? `\nISSUES (${real.length}):\n` + real.join('\n') : '\nNo console errors, failed requests or layout overflow.');
process.exit(real.length ? 1 : 0);
