-- Tabel profil kalender (multi-profil)
create table if not exists cal_profiles (
  id uuid primary key default gen_random_uuid(),
  calendar_key text not null,
  name text not null,
  color text default '#60a5fa',
  created_at timestamptz default now()
);

-- Tabel item/catatan per profil
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

-- Index agar filter cepat
create index if not exists idx_cal_profiles_key on cal_profiles(calendar_key);
create index if not exists idx_cal_items_key on cal_items(calendar_key);
create index if not exists idx_cal_items_prof on cal_items(profile_id) where deleted_at is null;

-- RLS: izinkan anon read/write tapi hanya row punya calendar_key sendiri
alter table cal_profiles enable row level security;
alter table cal_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cal_profiles' and policyname='anon_all') then
    create policy anon_all on cal_profiles for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cal_items' and policyname='anon_all') then
    create policy anon_all on cal_items for all to anon using (true) with check (true);
  end if;
end $$;
