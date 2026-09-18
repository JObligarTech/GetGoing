-- Voya core schema: the Trip is the context for everything.
-- Every table hangs off trips and is protected by trip-membership RLS (next migration).

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Enums ───────────────────────────────────────────────────────────────────
create type public.trip_status as enum ('draft', 'upcoming', 'active', 'past');
create type public.member_role as enum ('owner', 'editor', 'viewer');
create type public.stay_kind as enum ('hotel', 'airbnb', 'hostel', 'friend', 'rental', 'other');
create type public.place_priority as enum ('must', 'maybe', 'skip');

-- ─── Profiles (1:1 with auth.users) ─────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 80),
  avatar_url    text,
  home_currency char(3) not null default 'USD' check (home_currency ~ '^[A-Z]{3}$'),
  home_tz       text not null default 'UTC',
  locale        text not null default 'en',
  theme         text not null default 'system' check (theme in ('system','light','dark')),
  marketing_opt_in boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is 'Public profile + trip defaults reused by every tool.';

-- ─── Trips ───────────────────────────────────────────────────────────────────
create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  cover_letter  char(1) generated always as (upper(left(name, 1))) stored,
  countries     text[] not null default '{}',
  cities        text[] not null default '{}',
  start_date    date,
  end_date      date,
  status        public.trip_status not null default 'draft',
  local_currency char(3) check (local_currency ~ '^[A-Z]{3}$'),
  local_tz      text,
  local_language text, -- BCP-47, e.g. 'ja'
  notes         text check (char_length(notes) <= 4000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint trips_dates_ordered check (start_date is null or end_date is null or start_date <= end_date)
);
create index trips_owner_idx on public.trips(owner_id);

-- ─── Trip members (who can see/edit the trip) ───────────────────────────────
create table public.trip_members (
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.member_role not null default 'editor',
  created_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members(user_id);

-- ─── Travelers (people on the trip; do NOT need a Voya account) ─────────────
create table public.travelers (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 80),
  color       text not null default '#2F5D3A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now()
);
create index travelers_trip_idx on public.travelers(trip_id);

-- ─── Categories (custom, per trip) ───────────────────────────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  icon        text not null default 'pin' check (char_length(icon) <= 32),
  color       text not null default '#2F5D3A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (trip_id, name)
);

-- ─── Places (saved places; stays are a special kind, see stays) ─────────────
create table public.places (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 160),
  address       text check (char_length(address) <= 400),
  local_name    text check (char_length(local_name) <= 160),   -- e.g. 日本語 name for taxis
  local_address text check (char_length(local_address) <= 400),
  lat           double precision check (lat between -90 and 90),
  lng           double precision check (lng between -180 and 180),
  provider      text,            -- 'osm' | 'google' | 'manual'
  provider_ref  text,            -- external id
  phone         text check (char_length(phone) <= 40),
  website       text check (char_length(website) <= 400),
  hours         jsonb,
  notes         text check (char_length(notes) <= 4000),
  priority      public.place_priority not null default 'maybe',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index places_trip_idx on public.places(trip_id);

create table public.place_categories (
  place_id    uuid not null references public.places(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (place_id, category_id)
);

-- ─── Stays (accommodation = place + booking details) ────────────────────────
create table public.stays (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  place_id      uuid not null references public.places(id) on delete cascade,
  kind          public.stay_kind not null default 'hotel',
  check_in      timestamptz,
  check_out     timestamptz,
  confirmation  text check (char_length(confirmation) <= 80),
  notes         text check (char_length(notes) <= 4000),
  created_at    timestamptz not null default now(),
  constraint stays_dates_ordered check (check_in is null or check_out is null or check_in < check_out)
);
create index stays_trip_idx on public.stays(trip_id);

-- ─── Itinerary items (a place scheduled on a day; open slots have no place) ─
create table public.itinerary_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  place_id    uuid references public.places(id) on delete set null,
  day         date not null,
  start_time  time,
  end_time    time,
  title       text check (char_length(title) <= 160),   -- used for open slots ("Harajuku lunch")
  note        text check (char_length(note) <= 1000),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  constraint itinerary_has_subject check (place_id is not null or title is not null)
);
create index itinerary_trip_day_idx on public.itinerary_items(trip_id, day, sort_order);

-- ─── updated_at trigger ─────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trips_updated    before update on public.trips    for each row execute function public.set_updated_at();
create trigger places_updated   before update on public.places   for each row execute function public.set_updated_at();

-- ─── Auto-create profile + owner membership ─────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, marketing_opt_in)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Traveler'),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_new_trip() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.owner_id, 'owner');
  -- Owner is always a traveler too.
  insert into public.travelers (trip_id, user_id, name)
  select new.id, p.id, p.display_name from public.profiles p where p.id = new.owner_id;
  return new;
end $$;

create trigger on_trip_created
  after insert on public.trips for each row execute function public.handle_new_trip();
