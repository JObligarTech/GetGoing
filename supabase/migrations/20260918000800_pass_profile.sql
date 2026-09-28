-- Round 6: Atlas Premium Pass purchases and gifts, profile defaults and settings.
--
-- Security model
--   * Entitlements are still written only by the billing webhook (service role) through
--     grant_pass / grant_extension; clients can only read their own rows.
--   * A gift is created by a Monthly/Yearly member for one traveler per trip. The code is
--     the only way to redeem it; redeeming links the traveler to the redeemer's account
--     (like an invite) and inserts the gift entitlement inside the same RPC.
--   * trip_pass_marks exposes only "which members hold a pass, and of what kind" to
--     trip members, so avatars can carry the mark without leaking purchase details.

-- ─── Profile defaults & settings ─────────────────────────────────────────────
alter table public.profiles
  add column units      text   not null default 'km' check (units in ('km', 'mi')),
  add column languages  text[] not null default '{en}' check (cardinality(languages) between 1 and 8),
  add column settings   jsonb  not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4096);

-- ─── Pass kinds: gifts can be extended for up to 7 days ──────────────────────
alter type public.pass_kind add value if not exists 'extension';
create type public.gift_status as enum ('sent', 'accepted', 'expired', 'revoked');

-- ─── Gifts ───────────────────────────────────────────────────────────────────
create table public.pass_gifts (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  giver_id     uuid references public.profiles(id) on delete set null, -- kept when the giver leaves; the recipient's pass stands
  traveler_id  uuid not null references public.travelers(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete set null,
  code         text not null unique default encode(gen_random_bytes(12), 'hex'),
  status       public.gift_status not null default 'sent',
  days         int  not null default 3 check (days between 1 and 7),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '30 days',
  accepted_at  timestamptz,
  ends_at      timestamptz
);
create index pass_gifts_trip_idx on public.pass_gifts(trip_id);
-- One gift per member per trip ("1 gift available this trip · resets with each new trip").
create unique index pass_gifts_one_per_trip on public.pass_gifts(trip_id, giver_id) where status <> 'revoked';
alter table public.pass_gifts enable row level security;
-- The giver and the recipient read a gift (the code is the key to redeem it); only the RPCs write.
create policy pass_gifts_select on public.pass_gifts for select to authenticated using (giver_id = auth.uid() or recipient_id = auth.uid());
revoke all on public.pass_gifts from anon;

-- Entitlement bookkeeping written by the webhook: which receipt, how it was paid, and the gift it came from.
alter table public.entitlements
  add column gift_id   uuid references public.pass_gifts(id) on delete set null,
  add column plan_ref  text check (plan_ref is null or char_length(plan_ref) <= 120),
  add column paid_with text check (paid_with is null or char_length(paid_with) <= 40),
  add column amount    numeric(8,2) check (amount is null or amount >= 0),
  add column currency  char(3) check (currency is null or currency ~ '^[A-Z]{3}$');
-- A pass lookup key for the webhook's idempotency: the same receipt never grants twice.
create unique index entitlements_plan_ref_idx on public.entitlements(plan_ref) where plan_ref is not null;

-- ─── Helpers ─────────────────────────────────────────────────────────────────
-- The caller's active pass for a trip (trip-scoped passes only count on their trip).
create or replace function public.active_pass(p_user uuid, p_trip uuid) returns public.entitlements
language sql stable security definer set search_path = public as $$
  select e.* from public.entitlements e
  where e.user_id = p_user and e.starts_at <= now() and e.ends_at > now() and (e.trip_id is null or e.trip_id = p_trip)
  order by e.ends_at desc limit 1;
$$;
-- Supabase grants execute on new public functions to anon/authenticated by default; internal helpers are revoked explicitly.
revoke all on function public.active_pass(uuid, uuid) from public, anon, authenticated;

-- Midnight at the end of the local day `p_days` days after `p_at`, in the trip's zone.
create or replace function public.midnight_after(p_at timestamptz, p_tz text, p_days int) returns timestamptz
language sql immutable as $$
  select ((p_at at time zone p_tz)::date + p_days + 1)::timestamp at time zone p_tz;
$$;

-- Who on a trip holds a pass, kind only. Members only; nothing about price, receipts or dates.
create or replace function public.trip_pass_marks(p_trip_id uuid) returns table (user_id uuid, kind public.pass_kind)
language sql stable security definer set search_path = public as $$
  select distinct on (e.user_id) e.user_id, e.kind
  from public.entitlements e
  join public.trip_members m on m.user_id = e.user_id and m.trip_id = p_trip_id
  where public.is_trip_member(p_trip_id) and e.starts_at <= now() and e.ends_at > now() and (e.trip_id is null or e.trip_id = p_trip_id)
  order by e.user_id, e.ends_at desc;
$$;
revoke all on function public.trip_pass_marks(uuid) from public, anon;
grant execute on function public.trip_pass_marks(uuid) to authenticated;

-- ─── Gifting RPCs ────────────────────────────────────────────────────────────
create or replace function public.create_pass_gift(p_trip_id uuid, p_traveler_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pass public.entitlements; tr public.travelers%rowtype; g public.pass_gifts%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_trip_member(p_trip_id) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  pass := public.active_pass(auth.uid(), p_trip_id);
  if pass.id is null or pass.kind not in ('monthly', 'yearly') then raise exception 'gifting comes with the Monthly and Yearly pass' using errcode = 'P0001'; end if;
  select * into tr from public.travelers where id = p_traveler_id and trip_id = p_trip_id;
  if not found then raise exception 'traveler not on this trip' using errcode = 'P0002'; end if;
  if tr.user_id = auth.uid() then raise exception 'you cannot gift yourself' using errcode = 'P0001'; end if;
  if tr.user_id is not null and (public.active_pass(tr.user_id, p_trip_id)).id is not null then raise exception 'they already have a pass' using errcode = 'P0001'; end if;
  insert into public.pass_gifts (trip_id, giver_id, traveler_id) values (p_trip_id, auth.uid(), p_traveler_id) returning * into g;
  return jsonb_build_object('id', g.id, 'code', g.code, 'expires_at', g.expires_at, 'days', g.days);
exception when unique_violation then
  raise exception 'you have used this trip''s gift' using errcode = 'P0001';
end $$;
revoke all on function public.create_pass_gift(uuid, uuid) from public, anon;
grant execute on function public.create_pass_gift(uuid, uuid) to authenticated;

-- Public preview by code: the giver's first name, the trip, the days — enough for the "A gift from Joe" page.
create or replace function public.gift_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip_name', t.name, 'trip_tz', t.local_tz, 'trip_end', t.end_date, 'days', g.days, 'status', g.status,
    'giver_name', coalesce(split_part(p.display_name, ' ', 1), 'A traveler'), 'traveler_name', tr.name, 'expired', g.expires_at <= now(),
    'ends_preview', public.midnight_after(now(), coalesce(t.local_tz, 'UTC'), g.days)
  )
  from public.pass_gifts g
  join public.trips t on t.id = g.trip_id
  left join public.profiles p on p.id = g.giver_id
  join public.travelers tr on tr.id = g.traveler_id
  where g.code = p_code;
$$;
revoke all on function public.gift_preview(text) from public;
grant execute on function public.gift_preview(text) to anon, authenticated;

-- Accept: join the trip as the gifted traveler (if not already a member) and receive the entitlement.
create or replace function public.redeem_gift(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.pass_gifts%rowtype; tr public.travelers%rowtype; tz text; ends timestamptz; e_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into g from public.pass_gifts where code = p_code for update;
  if not found or g.status <> 'sent' or g.expires_at <= now() then raise exception 'gift not found or no longer available' using errcode = 'P0002'; end if;
  if g.giver_id is not distinct from auth.uid() then raise exception 'you cannot redeem your own gift' using errcode = 'P0001'; end if;
  select * into tr from public.travelers where id = g.traveler_id;
  if tr.user_id is not null and tr.user_id <> auth.uid() then raise exception 'this gift is for someone else' using errcode = '42501'; end if;
  if (public.active_pass(auth.uid(), g.trip_id)).id is not null then raise exception 'you already have a pass for this trip' using errcode = 'P0001'; end if;
  insert into public.trip_members (trip_id, user_id, role) values (g.trip_id, auth.uid(), 'editor') on conflict (trip_id, user_id) do nothing;
  update public.travelers set user_id = auth.uid() where id = g.traveler_id and user_id is null;
  select coalesce(local_tz, 'UTC') into tz from public.trips where id = g.trip_id;
  ends := public.midnight_after(now(), tz, g.days);
  insert into public.entitlements (user_id, kind, trip_id, starts_at, ends_at, gifted_by, source, gift_id)
    values (auth.uid(), 'gift', g.trip_id, now(), ends, g.giver_id, 'gift', g.id) returning id into e_id;
  update public.pass_gifts set status = 'accepted', recipient_id = auth.uid(), accepted_at = now(), ends_at = ends where id = g.id;
  return jsonb_build_object('entitlement_id', e_id, 'trip_id', g.trip_id, 'ends_at', ends);
end $$;
revoke all on function public.redeem_gift(text) from public, anon;
grant execute on function public.redeem_gift(text) to authenticated;

-- ─── Purchases (service role only; called by supabase/functions/billing-webhook) ──
create or replace function public.grant_pass(
  p_user_id uuid, p_kind public.pass_kind, p_trip_id uuid, p_plan_ref text, p_paid_with text, p_amount numeric, p_currency text, p_source text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.trips%rowtype; starts timestamptz := now(); ends timestamptz; e_id uuid; tz text;
begin
  if p_kind not in ('trip', 'monthly', 'yearly') then raise exception 'grant_pass handles purchased plans only' using errcode = 'P0001'; end if;
  -- Idempotent on the receipt: a retried webhook returns the existing grant.
  select id into e_id from public.entitlements where plan_ref = p_plan_ref;
  if found then return e_id; end if;
  if p_kind = 'monthly' then ends := starts + interval '1 month';
  elsif p_kind = 'yearly' then ends := starts + interval '1 year';
  else
    if p_trip_id is null then raise exception 'a single-trip pass needs a trip' using errcode = 'P0001'; end if;
    select * into t from public.trips where id = p_trip_id;
    tz := coalesce(t.local_tz, 'UTC');
    if t.start_date is not null then
      starts := least(now(), t.start_date::timestamp at time zone tz);
      ends := least((t.start_date + 15)::timestamp at time zone tz, coalesce((t.end_date + 1)::timestamp at time zone tz, (t.start_date + 15)::timestamp at time zone tz));
      if ends <= now() then ends := public.midnight_after(now(), tz, 14); end if;
    else
      ends := public.midnight_after(now(), tz, 14);
    end if;
  end if;
  insert into public.entitlements (user_id, kind, trip_id, starts_at, ends_at, source, plan_ref, paid_with, amount, currency)
    values (p_user_id, p_kind, case when p_kind = 'trip' then p_trip_id end, starts, ends, p_source, p_plan_ref, p_paid_with, p_amount, p_currency)
    returning id into e_id;
  return e_id;
end $$;
revoke all on function public.grant_pass(uuid, public.pass_kind, uuid, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.grant_pass(uuid, public.pass_kind, uuid, text, text, numeric, text, text) to service_role;

-- $0.99 extension of a gifted pass: continues from the gift's end for 1–7 whole trip days.
create or replace function public.grant_extension(p_user_id uuid, p_trip_id uuid, p_days int, p_plan_ref text, p_paid_with text, p_source text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g public.entitlements; tz text; ends timestamptz; e_id uuid;
begin
  if p_days < 1 or p_days > 7 then raise exception 'extensions run 1 to 7 days' using errcode = 'P0001'; end if;
  select id into e_id from public.entitlements where plan_ref = p_plan_ref;
  if found then return e_id; end if;
  select e.* into g from public.entitlements e where e.user_id = p_user_id and e.trip_id = p_trip_id and e.kind in ('gift', 'extension') order by e.ends_at desc limit 1;
  if g.id is null then raise exception 'no gifted pass to extend' using errcode = 'P0002'; end if;
  select coalesce(local_tz, 'UTC') into tz from public.trips where id = p_trip_id;
  ends := public.midnight_after(greatest(g.ends_at, now()) - interval '1 minute', tz, p_days);
  insert into public.entitlements (user_id, kind, trip_id, starts_at, ends_at, gifted_by, source, gift_id, plan_ref, paid_with, amount, currency)
    values (p_user_id, 'extension', p_trip_id, least(g.ends_at, now()), ends, g.gifted_by, p_source, g.gift_id, p_plan_ref, p_paid_with, 0.99, 'USD')
    returning id into e_id;
  return e_id;
end $$;
revoke all on function public.grant_extension(uuid, uuid, int, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_extension(uuid, uuid, int, text, text, text) to service_role;

-- ─── Export includes gifts (codes stripped) ──────────────────────────────────
create or replace function public.export_my_data() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'trips', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.trips t),
    'travelers', (select coalesce(jsonb_agg(to_jsonb(tr)), '[]'::jsonb) from public.travelers tr),
    'places', (select coalesce(jsonb_agg(to_jsonb(pl)), '[]'::jsonb) from public.places pl),
    'stays', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.stays s),
    'itinerary', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.itinerary_items i),
    'routes', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.routes r),
    'route_stops', (select coalesce(jsonb_agg(to_jsonb(rs)), '[]'::jsonb) from public.route_stops rs),
    'phrases', (select coalesce(jsonb_agg(to_jsonb(ph)), '[]'::jsonb) from public.phrases ph),
    'trip_currencies', (select coalesce(jsonb_agg(to_jsonb(tc)), '[]'::jsonb) from public.trip_currencies tc),
    'bills', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from public.bills b),
    'bill_items', (select coalesce(jsonb_agg(to_jsonb(bi)), '[]'::jsonb) from public.bill_items bi),
    'bill_participants', (select coalesce(jsonb_agg(to_jsonb(bp) - 'claim_token'), '[]'::jsonb) from public.bill_participants bp),
    'bill_shares', (select coalesce(jsonb_agg(to_jsonb(bs)), '[]'::jsonb) from public.bill_shares bs),
    'entitlements', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.entitlements e),
    'pass_gifts', (select coalesce(jsonb_agg(to_jsonb(g) - 'code'), '[]'::jsonb) from public.pass_gifts g where g.giver_id = auth.uid() or g.recipient_id = auth.uid()),
    'exported_at', now()
  );
$$;
