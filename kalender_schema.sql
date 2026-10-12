-- Kalender multi-profil (fix grants + RLS)
create table if not exists cal_profiles (
  id uuid primary key default gen_random_uuid(),
  calendar_key text not null,
  name text not null,
  color text default '#60a5fa',
  created_at timestamptz default now()
);

create table if not exists cal_items (
  id uuid primary key default gen_random_uuid(),
  calendar_key text not null,
  profile_id uuid not null references cal_profiles(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean default false,
  category text,
  tags jsonb default '[]',
  rrule text,
  reminder_min int,
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_cal_profiles_key on cal_profiles(calendar_key);
create index if not exists idx_cal_items_key on cal_items(calendar_key);
create index if not exists idx_cal_items_prof on cal_items(profile_id) where deleted_at is null;

alter table cal_profiles enable row level security;
alter table cal_items enable row level security;

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on cal_profiles to anon;
grant select, insert, update, delete on cal_items to anon;

drop policy if exists "anon_all_profiles" on cal_profiles;
drop policy if exists "anon_all_items" on cal_items;
drop policy if exists "anon_all" on cal_profiles;
drop policy if exists "anon_all" on cal_items;

create policy "anon_all_profiles" on cal_profiles for all to anon using (true) with check (true);
create policy "anon_all_items" on cal_items for all to anon using (true) with check (true);
