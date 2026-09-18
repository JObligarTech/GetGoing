-- Navigation trees: a saved route can split into branches (groups with their own
-- stops and travelers) after a trunk stop and meet again at the next trunk stop.

create table public.route_branches (
  id                  uuid primary key default gen_random_uuid(),
  route_id            uuid not null references public.routes(id) on delete cascade,
  trip_id             uuid not null references public.trips(id) on delete cascade,   -- denormalised for RLS
  name                text not null check (char_length(name) between 1 and 40),
  color               text not null default '#2F5D3A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order          int not null default 0,
  split_after_stop_id uuid not null references public.route_stops(id) on delete cascade,
  merge_mode          public.travel_mode,   -- last branch stop → meeting point; null = route default
  created_at          timestamptz not null default now()
);
create index route_branches_route_idx on public.route_branches(route_id, sort_order);

create table public.route_branch_travelers (
  branch_id   uuid not null references public.route_branches(id) on delete cascade,
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  trip_id     uuid not null references public.trips(id) on delete cascade,
  primary key (branch_id, traveler_id)
);

-- Stops belong to the trunk (null) or to one branch. `parent_stop_id` was reserved for this and is replaced.
alter table public.route_stops drop column parent_stop_id;
alter table public.route_stops add column branch_id uuid references public.route_branches(id) on delete cascade;
create index route_stops_branch_idx on public.route_stops(branch_id, sort_order);

-- ─── RLS: trip membership, like every other trip-scoped table ─────────────────
alter table public.route_branches enable row level security;
alter table public.route_branch_travelers enable row level security;
do $$
declare t text;
begin
  foreach t in array array['route_branches','route_branch_travelers'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_trip_member(trip_id, ''editor'')) with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_trip_member(trip_id, ''editor''))', t, t);
  end loop;
end $$;
revoke all on public.route_branches, public.route_branch_travelers from anon;

-- ─── Integrity guards (no cross-trip / cross-route references) ────────────────
create or replace function public.guard_route_stop() returns trigger
language plpgsql as $$
begin
  if new.trip_id <> (select trip_id from public.routes where id = new.route_id)
     or new.trip_id <> (select trip_id from public.places where id = new.place_id) then
    raise exception 'route stop must belong to the same trip as its route and place' using errcode = '23514';
  end if;
  if new.branch_id is not null and new.route_id <> (select route_id from public.route_branches where id = new.branch_id) then
    raise exception 'route stop branch must belong to the same route' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.guard_route_branch() returns trigger
language plpgsql as $$
begin
  if new.trip_id <> (select trip_id from public.routes where id = new.route_id)
     or new.route_id <> (select route_id from public.route_stops where id = new.split_after_stop_id) then
    raise exception 'branch must belong to the same trip and route as the stop it splits from' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger route_branches_guard before insert or update on public.route_branches
  for each row execute function public.guard_route_branch();

create or replace function public.guard_route_branch_traveler() returns trigger
language plpgsql as $$
begin
  if new.trip_id <> (select trip_id from public.route_branches where id = new.branch_id)
     or new.trip_id <> (select trip_id from public.travelers where id = new.traveler_id) then
    raise exception 'branch traveler must belong to the same trip as the branch' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger route_branch_travelers_guard before insert or update on public.route_branch_travelers
  for each row execute function public.guard_route_branch_traveler();

-- ─── Save a whole tree atomically ─────────────────────────────────────────────
-- Replaces the route's stops/branches/travelers in one transaction. Runs as the caller
-- (security invoker), so every insert is still subject to RLS and the guards above.
-- p_stops:    [{id, place_id, branch_id?, sort_order, planned_time?, dwell_min?, mode?}]
-- p_branches: [{id, name, color?, sort_order, split_after_stop_id, merge_mode?, traveler_ids: []}]
create or replace function public.save_route_tree(
  p_route_id uuid, p_trip_id uuid, p_name text, p_day date, p_mode public.travel_mode, p_stops jsonb, p_branches jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := coalesce(p_route_id, gen_random_uuid());
  s jsonb; b jsonb; t jsonb;
begin
  if jsonb_typeof(p_stops) <> 'array' or jsonb_typeof(p_branches) <> 'array' then
    raise exception 'stops and branches must be arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(p_stops) < 2 or jsonb_array_length(p_stops) > 60 or jsonb_array_length(p_branches) > 12 then
    raise exception 'a route needs 2–60 stops and at most 12 branches' using errcode = '23514';
  end if;

  if p_route_id is null then
    insert into public.routes (id, trip_id, name, day, mode, created_by) values (v_id, p_trip_id, p_name, p_day, p_mode, auth.uid());
  else
    update public.routes set name = p_name, day = p_day, mode = p_mode where id = v_id and trip_id = p_trip_id;
    if not found then raise exception 'route not found' using errcode = 'P0002'; end if;
    delete from public.route_stops where route_id = v_id;   -- cascades to branches and their travelers
  end if;

  for s in select value from jsonb_array_elements(p_stops) loop
    insert into public.route_stops (id, route_id, trip_id, place_id, sort_order, planned_time, dwell_min, mode)
    values ((s->>'id')::uuid, v_id, p_trip_id, (s->>'place_id')::uuid, coalesce((s->>'sort_order')::int, 0),
            (s->>'planned_time')::time, (s->>'dwell_min')::int, (s->>'mode')::public.travel_mode);
  end loop;
  for b in select value from jsonb_array_elements(p_branches) loop
    insert into public.route_branches (id, route_id, trip_id, name, color, sort_order, split_after_stop_id, merge_mode)
    values ((b->>'id')::uuid, v_id, p_trip_id, b->>'name', coalesce(b->>'color', '#2F5D3A'), coalesce((b->>'sort_order')::int, 0),
            (b->>'split_after_stop_id')::uuid, (b->>'merge_mode')::public.travel_mode);
    for t in select value from jsonb_array_elements(coalesce(b->'traveler_ids', '[]'::jsonb)) loop
      insert into public.route_branch_travelers (branch_id, traveler_id, trip_id) values ((b->>'id')::uuid, (t#>>'{}')::uuid, p_trip_id);
    end loop;
  end loop;
  for s in select value from jsonb_array_elements(p_stops) where value->>'branch_id' is not null loop
    update public.route_stops set branch_id = (s->>'branch_id')::uuid where id = (s->>'id')::uuid and route_id = v_id;
  end loop;
  return v_id;
end $$;
revoke all on function public.save_route_tree(uuid, uuid, text, date, public.travel_mode, jsonb, jsonb) from public;
grant execute on function public.save_route_tree(uuid, uuid, text, date, public.travel_mode, jsonb, jsonb) to authenticated;
