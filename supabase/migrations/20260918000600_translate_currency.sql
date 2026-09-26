-- Translate + Currency: saved phrases per trip, and the extra currencies a trip uses
-- ("KRW · Seoul layover"). Rates themselves are never stored server-side; clients cache them.

create table public.phrases (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1 and 500),
  source_lang text not null check (source_lang ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  target_text text not null check (char_length(target_text) between 1 and 1000),
  target_lang text not null check (target_lang ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  romanized   text check (char_length(romanized) <= 1000),
  sort_order  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index phrases_trip_idx on public.phrases(trip_id, sort_order);
comment on table public.phrases is 'Saved translations, scoped to a trip so every traveler shares them.';

create table public.trip_currencies (
  trip_id     uuid not null references public.trips(id) on delete cascade,
  code        char(3) not null check (code ~ '^[A-Z]{3}$'),
  label       text check (char_length(label) <= 60),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  primary key (trip_id, code)
);

-- ─── RLS: trip membership, like every other trip-scoped table ─────────────────
alter table public.phrases enable row level security;
alter table public.trip_currencies enable row level security;
do $$
declare t text;
begin
  foreach t in array array['phrases','trip_currencies'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_trip_member(trip_id, ''editor'')) with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_trip_member(trip_id, ''editor''))', t, t);
  end loop;
end $$;
revoke all on public.phrases, public.trip_currencies from anon;

-- Cap saved phrases per trip so a member can't fill the table.
create or replace function public.guard_phrase_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.phrases where trip_id = new.trip_id) >= 200 then
    raise exception 'a trip can hold up to 200 saved phrases' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger phrases_limit before insert on public.phrases for each row execute function public.guard_phrase_limit();

-- The data export now includes the new tables.
create or replace function public.export_my_data() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'trips', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.trips t),
    'places', (select coalesce(jsonb_agg(to_jsonb(pl)), '[]'::jsonb) from public.places pl),
    'stays', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.stays s),
    'itinerary', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.itinerary_items i),
    'routes', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.routes r),
    'route_stops', (select coalesce(jsonb_agg(to_jsonb(rs)), '[]'::jsonb) from public.route_stops rs),
    'phrases', (select coalesce(jsonb_agg(to_jsonb(ph)), '[]'::jsonb) from public.phrases ph),
    'trip_currencies', (select coalesce(jsonb_agg(to_jsonb(tc)), '[]'::jsonb) from public.trip_currencies tc),
    'exported_at', now()
  );
$$;
