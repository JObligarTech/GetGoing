-- Row Level Security. Deny-by-default; access flows from trip membership.

alter table public.profiles        enable row level security;
alter table public.trips           enable row level security;
alter table public.trip_members    enable row level security;
alter table public.travelers       enable row level security;
alter table public.categories      enable row level security;
alter table public.places          enable row level security;
alter table public.place_categories enable row level security;
alter table public.stays           enable row level security;
alter table public.itinerary_items enable row level security;

-- Helper: is the current user a member of this trip (optionally with edit rights)?
-- security definer so it can read trip_members without recursing into its own policy.
create or replace function public.is_trip_member(p_trip uuid, p_min_role public.member_role default 'viewer')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip
      and m.user_id = auth.uid()
      and case p_min_role
            when 'owner'  then m.role = 'owner'
            when 'editor' then m.role in ('owner','editor')
            else true
          end
  );
$$;
revoke all on function public.is_trip_member(uuid, public.member_role) from public;
grant execute on function public.is_trip_member(uuid, public.member_role) to authenticated;

-- ─── profiles: you can see yourself and co-travelers; only edit yourself ─────
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.trip_members a
      join public.trip_members b on a.trip_id = b.trip_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- inserts happen only via the auth trigger; no insert policy on purpose.
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = auth.uid());

-- ─── trips ──────────────────────────────────────────────────────────────────
create policy trips_select on public.trips for select to authenticated
  using (public.is_trip_member(id));
create policy trips_insert on public.trips for insert to authenticated
  with check (owner_id = auth.uid());
create policy trips_update on public.trips for update to authenticated
  using (public.is_trip_member(id, 'editor')) with check (public.is_trip_member(id, 'editor'));

-- Ownership transfer is owner-only, enforced by trigger (policies can't compare OLD/NEW).
create or replace function public.guard_trip_owner_change() returns trigger
language plpgsql as $$
begin
  if new.owner_id <> old.owner_id and old.owner_id <> auth.uid() then
    raise exception 'only the owner can transfer a trip' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trips_guard_owner before update on public.trips
  for each row execute function public.guard_trip_owner_change();
create policy trips_delete on public.trips for delete to authenticated
  using (owner_id = auth.uid());

-- ─── trip_members ───────────────────────────────────────────────────────────
create policy members_select on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
create policy members_insert on public.trip_members for insert to authenticated
  with check (public.is_trip_member(trip_id, 'owner'));
create policy members_update on public.trip_members for update to authenticated
  using (public.is_trip_member(trip_id, 'owner') and role <> 'owner');
create policy members_delete on public.trip_members for delete to authenticated
  using (role <> 'owner' and (public.is_trip_member(trip_id, 'owner') or user_id = auth.uid()));

-- ─── Generic trip-scoped tables: members read, editors write ────────────────
do $$
declare t text;
begin
  foreach t in array array['travelers','categories','places','stays','itinerary_items'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_trip_member(trip_id, ''editor'')) with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_trip_member(trip_id, ''editor''))', t, t);
  end loop;
end $$;

-- place_categories has no trip_id; derive it from the place.
create policy place_categories_select on public.place_categories for select to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and public.is_trip_member(p.trip_id)));
create policy place_categories_write on public.place_categories for all to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and public.is_trip_member(p.trip_id, 'editor')))
  with check (exists (select 1 from public.places p where p.id = place_id and public.is_trip_member(p.trip_id, 'editor')));

-- ─── Lock down the anon role entirely; the public claim-link page (future) will use a
--     dedicated token-scoped RPC rather than table access.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
