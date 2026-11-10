-- GreenTrack database schema (safe to run multiple times)
create extension if not exists "uuid-ossp";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text,
  password_hash text not null,
  targets jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- items (every logged activity / resource entry) ----------
create table if not exists public.items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  ai_summary text,
  category text not null default 'commute',
  subtype text not null default 'car_petrol',
  quantity numeric not null default 0,
  unit text,
  co2_kg numeric not null default 0,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists items_user_date_idx on public.items (user_id, entry_date desc);

-- ---------- community challenges ----------
create table if not exists public.challenges (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category text not null default 'general',
  duration_days integer not null default 7,
  co2_per_checkin numeric not null default 1,
  goal_checkins integer not null default 100,
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_members (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkins integer not null default 0,
  last_checkin date,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on public.challenge_members (user_id);

-- ---------- Row Level Security ----------
-- The Express backend uses the service_role key (which bypasses RLS) and enforces ownership itself.
-- These policies make sure nobody can read or change data directly with the public anon key.
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can view own items" on public.items;
create policy "Users can view own items" on public.items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own items" on public.items;
create policy "Users can insert own items" on public.items
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own items" on public.items;
create policy "Users can update own items" on public.items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own items" on public.items;
create policy "Users can delete own items" on public.items
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Members can view challenges" on public.challenges;
create policy "Members can view challenges" on public.challenges
  for select to authenticated using (true);
drop policy if exists "Users can create challenges" on public.challenges;
create policy "Users can create challenges" on public.challenges
  for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "Creators can update challenges" on public.challenges;
create policy "Creators can update challenges" on public.challenges
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "Creators can delete challenges" on public.challenges;
create policy "Creators can delete challenges" on public.challenges
  for delete to authenticated using (auth.uid() = created_by);

drop policy if exists "Members can view participation" on public.challenge_members;
create policy "Members can view participation" on public.challenge_members
  for select to authenticated using (true);
drop policy if exists "Users can join challenges" on public.challenge_members;
create policy "Users can join challenges" on public.challenge_members
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own participation" on public.challenge_members;
create policy "Users can update own participation" on public.challenge_members
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can leave challenges" on public.challenge_members;
create policy "Users can leave challenges" on public.challenge_members
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- Privileges ----------
-- anon gets nothing; password hashes are never readable through the public API.
revoke all on public.profiles, public.items, public.challenges, public.challenge_members from anon;
grant all on public.profiles, public.items, public.challenges, public.challenge_members to service_role;
grant select, insert, update, delete on public.items, public.challenges, public.challenge_members to authenticated;
revoke all on public.profiles from authenticated;
grant select (id, email, full_name, targets, created_at), update (full_name, targets) on public.profiles to authenticated;

-- ---------- Starter community challenges ----------
insert into public.challenges (title, description, category, duration_days, co2_per_checkin, goal_checkins)
select v.title, v.description, v.category, v.duration_days, v.co2_per_checkin, v.goal_checkins
from (values
  ('Zero-Plastic Week', 'Say no to single-use plastic for 7 days. Carry a bottle, a bag and a box. Check in every day you stay plastic-free.', 'plastic', 7, 0.5, 200),
  ('Energy-Saving Days', 'Switch off idle lights, fans and chargers, and set the AC to 24°C or higher. Check in each day you cut energy waste.', 'energy', 14, 1.2, 300),
  ('Car-Free Commute', 'Walk, cycle or take public transport instead of driving. Every car-free day counts for the whole community.', 'commute', 10, 2.4, 250),
  ('Meatless Mondays', 'Go fully plant-based one day a week. Check in on each meat-free day and discover new recipes.', 'food', 30, 3, 150),
  ('Water Warrior', 'Five-minute showers, fixed leaks and full laundry loads only. Check in each day you save water.', 'water', 14, 0.3, 300),
  ('Recycle Right', 'Segregate wet, dry and e-waste every single day. Check in whenever your bins are sorted correctly.', 'waste', 21, 0.6, 400)
) as v(title, description, category, duration_days, co2_per_checkin, goal_checkins)
where not exists (
  select 1 from public.challenges c where c.title = v.title and c.created_by is null
);

-- Tell the Supabase API layer to pick up the new tables immediately
notify pgrst, 'reload schema';
