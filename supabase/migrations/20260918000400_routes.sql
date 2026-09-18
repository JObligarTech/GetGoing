-- Named / saved routes ("Airport → Hotel", "Morning Shibuya"). Stops reference saved places.
-- Navigation trees (branches per group) come in a later migration; `parent_stop_id` is reserved for it.

create type public.travel_mode as enum ('walk', 'transit', 'drive', 'cycle');

create table public.routes (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  day         date,
  mode        public.travel_mode not null default 'transit',
  notes       text check (char_length(notes) <= 2000),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index routes_trip_idx on public.routes(trip_id, day);
create trigger routes_updated before update on public.routes for each row execute function public.set_updated_at();

create table public.route_stops (
  id            uuid primary key default gen_random_uuid(),
  route_id      uuid not null references public.routes(id) on delete cascade,
  trip_id       uuid not null references public.trips(id) on delete cascade,  -- denormalised for RLS
  place_id      uuid not null references public.places(id) on delete cascade,
  sort_order    int not null default 0,
  planned_time  time,
  dwell_min     int check (dwell_min between 0 and 1440),
  mode          public.travel_mode,           -- per-segment override (mode to reach this stop)
  parent_stop_id uuid references public.route_stops(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index route_stops_route_idx on public.route_stops(route_id, sort_order);

-- RLS: same trip-membership rule as every other trip-scoped table.
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
do $$
declare t text;
begin
  foreach t in array array['routes','route_stops'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_trip_member(trip_id, ''editor'')) with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_trip_member(trip_id, ''editor''))', t, t);
  end loop;
end $$;

-- A stop's trip must match its route's trip and its place's trip (no cross-trip references).
create or replace function public.guard_route_stop() returns trigger
language plpgsql as $$
begin
  if new.trip_id <> (select trip_id from public.routes where id = new.route_id)
     or new.trip_id <> (select trip_id from public.places where id = new.place_id) then
    raise exception 'route stop must belong to the same trip as its route and place' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger route_stops_guard before insert or update on public.route_stops
  for each row execute function public.guard_route_stop();

revoke all on public.routes, public.route_stops from anon;
