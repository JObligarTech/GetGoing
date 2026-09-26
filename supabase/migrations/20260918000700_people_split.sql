-- People (guest details, invite links) and Split (bills, items, participants, shares,
-- no-account claim links) plus Atlas Premium Pass entitlements.

-- ─── Travelers: guests carry contact, home currency and the dates they join ───
alter table public.travelers
  add column email          citext check (email is null or char_length(email) <= 254),
  add column phone          text check (phone is null or char_length(phone) <= 40),
  add column home_currency  char(3) check (home_currency is null or home_currency ~ '^[A-Z]{3}$'),
  add column joining_start  date,
  add column joining_end    date,
  add column joining_note   text check (joining_note is null or char_length(joining_note) <= 80),
  add column updated_at     timestamptz not null default now(),
  add constraint travelers_joining_ordered check (joining_start is null or joining_end is null or joining_start <= joining_end);
create trigger travelers_updated before update on public.travelers for each row execute function public.set_updated_at();

-- ─── Invite links: a guest becomes a member later, by link only ──────────────
create table public.trip_invites (
  token        text primary key default encode(gen_random_bytes(18), 'hex'),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  traveler_id  uuid references public.travelers(id) on delete cascade,
  role         public.member_role not null default 'editor' check (role <> 'owner'),
  created_by   uuid references public.profiles(id) on delete set null,
  expires_at   timestamptz not null default now() + interval '30 days',
  accepted_by  uuid references public.profiles(id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index trip_invites_trip_idx on public.trip_invites(trip_id);
alter table public.trip_invites enable row level security;
create policy trip_invites_select on public.trip_invites for select to authenticated using (public.is_trip_member(trip_id));
create policy trip_invites_insert on public.trip_invites for insert to authenticated with check (public.is_trip_member(trip_id, 'editor') and created_by = auth.uid());
create policy trip_invites_delete on public.trip_invites for delete to authenticated using (public.is_trip_member(trip_id, 'editor'));
revoke all on public.trip_invites from anon;

-- What a link shows before sign-in: trip name, who invited, the guest's name. Nothing else.
create or replace function public.invite_preview(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip_name', t.name,
    'inviter', coalesce(split_part(p.display_name, ' ', 1), 'A traveler'),
    'traveler', tr.name,
    'expires_at', i.expires_at,
    'accepted', i.accepted_at is not null
  )
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  left join public.profiles p on p.id = i.created_by
  left join public.travelers tr on tr.id = i.traveler_id
  where i.token = p_token and i.expires_at > now();
$$;
revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- Accept: membership with the invite's role, and the guest row becomes this account's row.
create or replace function public.accept_trip_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.trip_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into i from public.trip_invites where token = p_token and expires_at > now() and accepted_at is null for update;
  if not found then raise exception 'invite not found or expired' using errcode = 'P0002'; end if;
  insert into public.trip_members (trip_id, user_id, role) values (i.trip_id, auth.uid(), i.role) on conflict (trip_id, user_id) do nothing;
  if i.traveler_id is not null then
    update public.travelers set user_id = auth.uid() where id = i.traveler_id and user_id is null;
  elsif not exists (select 1 from public.travelers where trip_id = i.trip_id and user_id = auth.uid()) then
    insert into public.travelers (trip_id, user_id, name) select i.trip_id, p.id, p.display_name from public.profiles p where p.id = auth.uid();
  end if;
  update public.trip_invites set accepted_by = auth.uid(), accepted_at = now() where token = p_token;
  return i.trip_id;
end $$;
revoke all on function public.accept_trip_invite(text) from public;
grant execute on function public.accept_trip_invite(text) to authenticated;

-- ─── Bills ───────────────────────────────────────────────────────────────────
create type public.bill_status as enum ('draft', 'open', 'settled');
create type public.claim_status as enum ('none', 'sent', 'opened', 'claimed');

create table public.bills (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  place_id         uuid references public.places(id) on delete set null,
  merchant         text not null check (char_length(merchant) between 1 and 120),
  currency         char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status           public.bill_status not null default 'draft',
  bill_date        date,
  tax_amount       numeric(12,2) not null default 0 check (tax_amount >= 0),
  tax_label        text check (tax_label is null or char_length(tax_label) <= 40),
  service_amount   numeric(12,2) not null default 0 check (service_amount >= 0),
  discount_amount  numeric(12,2) not null default 0 check (discount_amount >= 0),
  rounding_unit    numeric(12,2) not null default 1 check (rounding_unit > 0),
  tax_mode         text not null default 'proportional' check (tax_mode in ('proportional', 'even')),
  paid_by          uuid,                     -- bill_participants.id, FK below
  receipt_pages    int not null default 0 check (receipt_pages between 0 and 10),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  closed_at        timestamptz
);
create index bills_trip_idx on public.bills(trip_id, created_at desc);
create trigger bills_updated before update on public.bills for each row execute function public.set_updated_at();

create table public.bill_participants (
  id               uuid primary key default gen_random_uuid(),
  bill_id          uuid not null references public.bills(id) on delete cascade,
  trip_id          uuid not null references public.trips(id) on delete cascade,
  traveler_id      uuid references public.travelers(id) on delete set null,
  name             text not null check (char_length(name) between 1 and 80),
  color            text not null default '#2F5D3A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  home_currency    char(3) check (home_currency is null or home_currency ~ '^[A-Z]{3}$'),
  -- The claim link. Unguessable, per person, unusable until the sender shares it (claim_status <> 'none').
  claim_token      text unique default encode(gen_random_bytes(16), 'hex'),
  claim_status     public.claim_status not null default 'none',
  claim_expires_at timestamptz not null default now() + interval '30 days',
  created_at       timestamptz not null default now()
);
create index bill_participants_bill_idx on public.bill_participants(bill_id);
alter table public.bills add constraint bills_paid_by_fk foreign key (paid_by) references public.bill_participants(id) on delete set null deferrable initially deferred;

create table public.bill_items (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.bills(id) on delete cascade,
  trip_id     uuid not null references public.trips(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  local_name  text check (local_name is null or char_length(local_name) <= 120),
  qty         int not null default 1 check (qty between 1 and 99),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  confidence  numeric(4,3) check (confidence is null or confidence between 0 and 1),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index bill_items_bill_idx on public.bill_items(bill_id, sort_order);

create table public.bill_shares (
  item_id        uuid not null references public.bill_items(id) on delete cascade,
  participant_id uuid not null references public.bill_participants(id) on delete cascade,
  bill_id        uuid not null references public.bills(id) on delete cascade,
  trip_id        uuid not null references public.trips(id) on delete cascade,
  primary key (item_id, participant_id)
);

-- RLS: trip membership, like every other trip-scoped table. The anon role has no table access;
-- claim links go through the token-scoped functions below.
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.bill_participants enable row level security;
alter table public.bill_shares enable row level security;
do $$
declare t text;
begin
  foreach t in array array['bills','bill_items','bill_participants','bill_shares'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_trip_member(trip_id, ''editor'')) with check (public.is_trip_member(trip_id, ''editor''))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_trip_member(trip_id, ''editor''))', t, t);
  end loop;
end $$;
revoke all on public.bills, public.bill_items, public.bill_participants, public.bill_shares from anon;

-- Integrity: nothing crosses bills or trips. Tokens can't be chosen by clients.
create or replace function public.guard_bill_row() returns trigger
language plpgsql as $$
begin
  if new.trip_id is distinct from (select trip_id from public.bills where id = new.bill_id) then
    raise exception 'bill row must belong to the same trip as its bill' using errcode = '23514';
  end if;
  if tg_table_name = 'bill_participants' then
    if new.traveler_id is not null and new.trip_id is distinct from (select trip_id from public.travelers where id = new.traveler_id) then
      raise exception 'participant traveler must belong to the same trip' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and new.claim_token is distinct from old.claim_token then
      raise exception 'claim tokens are issued by the database' using errcode = '42501';
    end if;
  end if;
  if tg_table_name = 'bill_shares' then
    if new.bill_id is distinct from (select bill_id from public.bill_items where id = new.item_id)
       or new.bill_id is distinct from (select bill_id from public.bill_participants where id = new.participant_id) then
      raise exception 'share must join an item and a person on the same bill' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger bill_items_guard before insert or update on public.bill_items for each row execute function public.guard_bill_row();
create trigger bill_participants_guard before insert or update on public.bill_participants for each row execute function public.guard_bill_row();
create trigger bill_shares_guard before insert or update on public.bill_shares for each row execute function public.guard_bill_row();

create or replace function public.guard_bill() returns trigger
language plpgsql as $$
begin
  if new.place_id is not null and new.trip_id is distinct from (select trip_id from public.places where id = new.place_id) then
    raise exception 'bill place must belong to the same trip' using errcode = '23514';
  end if;
  if new.paid_by is not null and new.id is distinct from (select bill_id from public.bill_participants where id = new.paid_by) then
    raise exception 'payer must be a participant on this bill' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.status = 'settled' and new.status = 'settled' and (new.tax_amount, new.service_amount, new.discount_amount, new.merchant) is distinct from (old.tax_amount, old.service_amount, old.discount_amount, old.merchant) then
    raise exception 'reopen the bill before editing it' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger bills_guard before insert or update on public.bills for each row execute function public.guard_bill();

-- Save a whole bill atomically as the caller (RLS applies to every row).
-- p_bill: {place_id, merchant, currency, status, bill_date, tax_amount, tax_label, service_amount, discount_amount, rounding_unit, tax_mode, paid_by, receipt_pages}
-- p_items: [{id, name, local_name, qty, unit_price, confidence, sort_order}]   p_participants: [{id, traveler_id, name, color, home_currency}]
-- p_shares: [{item_id, participant_id}]. Existing participants keep their claim tokens and status.
create or replace function public.save_bill(p_bill_id uuid, p_trip_id uuid, p_bill jsonb, p_items jsonb, p_participants jsonb, p_shares jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := coalesce(p_bill_id, gen_random_uuid());
  r jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_typeof(p_participants) <> 'array' or jsonb_typeof(p_shares) <> 'array' then
    raise exception 'items, participants and shares must be arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 80 or jsonb_array_length(p_participants) not between 1 and 30 then
    raise exception 'a bill needs 1–80 items and 1–30 people' using errcode = '23514';
  end if;
  if p_bill_id is null then
    insert into public.bills (id, trip_id, place_id, merchant, currency, status, bill_date, tax_amount, tax_label, service_amount, discount_amount, rounding_unit, tax_mode, receipt_pages, created_by)
    values (v_id, p_trip_id, (p_bill->>'place_id')::uuid, p_bill->>'merchant', p_bill->>'currency', coalesce((p_bill->>'status')::public.bill_status, 'draft'), (p_bill->>'bill_date')::date,
            coalesce((p_bill->>'tax_amount')::numeric, 0), p_bill->>'tax_label', coalesce((p_bill->>'service_amount')::numeric, 0), coalesce((p_bill->>'discount_amount')::numeric, 0),
            coalesce((p_bill->>'rounding_unit')::numeric, 1), coalesce(p_bill->>'tax_mode', 'proportional'), coalesce((p_bill->>'receipt_pages')::int, 0), auth.uid());
  else
    update public.bills set place_id = (p_bill->>'place_id')::uuid, merchant = p_bill->>'merchant', currency = p_bill->>'currency', status = coalesce((p_bill->>'status')::public.bill_status, status),
      bill_date = (p_bill->>'bill_date')::date, tax_amount = coalesce((p_bill->>'tax_amount')::numeric, 0), tax_label = p_bill->>'tax_label', service_amount = coalesce((p_bill->>'service_amount')::numeric, 0),
      discount_amount = coalesce((p_bill->>'discount_amount')::numeric, 0), rounding_unit = coalesce((p_bill->>'rounding_unit')::numeric, 1), tax_mode = coalesce(p_bill->>'tax_mode', 'proportional'),
      receipt_pages = coalesce((p_bill->>'receipt_pages')::int, receipt_pages), paid_by = null,
      closed_at = case when (p_bill->>'status') = 'settled' then coalesce(closed_at, now()) else null end
    where id = v_id and trip_id = p_trip_id;
    if not found then raise exception 'bill not found' using errcode = 'P0002'; end if;
    delete from public.bill_items where bill_id = v_id and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_items));
    delete from public.bill_participants where bill_id = v_id and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_participants));
    delete from public.bill_shares where bill_id = v_id;
  end if;
  for r in select value from jsonb_array_elements(p_participants) loop
    insert into public.bill_participants (id, bill_id, trip_id, traveler_id, name, color, home_currency)
    values ((r->>'id')::uuid, v_id, p_trip_id, (r->>'traveler_id')::uuid, r->>'name', coalesce(r->>'color', '#2F5D3A'), r->>'home_currency')
    on conflict (id) do update set traveler_id = excluded.traveler_id, name = excluded.name, color = excluded.color, home_currency = excluded.home_currency
    where public.bill_participants.bill_id = v_id;
  end loop;
  for r in select value from jsonb_array_elements(p_items) loop
    insert into public.bill_items (id, bill_id, trip_id, name, local_name, qty, unit_price, confidence, sort_order)
    values ((r->>'id')::uuid, v_id, p_trip_id, r->>'name', r->>'local_name', coalesce((r->>'qty')::int, 1), (r->>'unit_price')::numeric, (r->>'confidence')::numeric, coalesce((r->>'sort_order')::int, 0))
    on conflict (id) do update set name = excluded.name, local_name = excluded.local_name, qty = excluded.qty, unit_price = excluded.unit_price, confidence = excluded.confidence, sort_order = excluded.sort_order
    where public.bill_items.bill_id = v_id;
  end loop;
  for r in select value from jsonb_array_elements(p_shares) loop
    insert into public.bill_shares (item_id, participant_id, bill_id, trip_id) values ((r->>'item_id')::uuid, (r->>'participant_id')::uuid, v_id, p_trip_id) on conflict do nothing;
  end loop;
  if p_bill ? 'paid_by' and p_bill->>'paid_by' is not null then
    update public.bills set paid_by = (p_bill->>'paid_by')::uuid where id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.save_bill(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_bill(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ─── Claim links (no account) ────────────────────────────────────────────────
-- Token-scoped view of one bill for the person the link was sent to. First names only; no trip,
-- no contact details, no other tokens. Marks the link as opened.
create or replace function public.bill_claim_view(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.bill_participants%rowtype; b public.bills%rowtype; v jsonb;
begin
  select * into me from public.bill_participants where claim_token = p_token and claim_status <> 'none' and claim_expires_at > now();
  if not found then return null; end if;
  select * into b from public.bills where id = me.bill_id;
  if me.claim_status = 'sent' then update public.bill_participants set claim_status = 'opened' where id = me.id; end if;
  select jsonb_build_object(
    'merchant', b.merchant, 'currency', b.currency, 'status', b.status::text,
    'sender', coalesce((select split_part(name, ' ', 1) from public.bill_participants where id = b.paid_by), (select split_part(display_name, ' ', 1) from public.profiles where id = b.created_by), 'A traveler'),
    'you', jsonb_build_object('id', me.id, 'name', split_part(me.name, ' ', 1)),
    'tax_amount', b.tax_amount, 'service_amount', b.service_amount, 'discount_amount', b.discount_amount, 'tax_mode', b.tax_mode, 'rounding_unit', b.rounding_unit,
    'participants', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', split_part(p.name, ' ', 1)) order by p.created_at), '[]'::jsonb) from public.bill_participants p where p.bill_id = b.id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'local_name', i.local_name, 'qty', i.qty, 'unit_price', i.unit_price) order by i.sort_order), '[]'::jsonb) from public.bill_items i where i.bill_id = b.id),
    'shares', (select coalesce(jsonb_agg(jsonb_build_object('item_id', s.item_id, 'participant_id', s.participant_id)), '[]'::jsonb) from public.bill_shares s where s.bill_id = b.id)
  ) into v;
  return v;
end $$;
revoke all on function public.bill_claim_view(text) from public;
grant execute on function public.bill_claim_view(text) to anon, authenticated;

-- Replace this person's picks. Only while the bill is open; only items on this bill.
create or replace function public.bill_claim_submit(p_token text, p_item_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.bill_participants%rowtype; b public.bills%rowtype;
begin
  select * into me from public.bill_participants where claim_token = p_token and claim_status <> 'none' and claim_expires_at > now() for update;
  if not found then raise exception 'link not found or expired' using errcode = 'P0002'; end if;
  select * into b from public.bills where id = me.bill_id;
  if b.status <> 'open' then raise exception 'this bill is closed' using errcode = '23514'; end if;
  if coalesce(array_length(p_item_ids, 1), 0) > 80 then raise exception 'too many items' using errcode = '23514'; end if;
  delete from public.bill_shares where participant_id = me.id;
  insert into public.bill_shares (item_id, participant_id, bill_id, trip_id)
  select i.id, me.id, b.id, b.trip_id from public.bill_items i where i.bill_id = b.id and i.id = any(p_item_ids);
  update public.bill_participants set claim_status = 'claimed' where id = me.id;
  return public.bill_claim_view(p_token);
end $$;
revoke all on function public.bill_claim_submit(text, uuid[]) from public;
grant execute on function public.bill_claim_submit(text, uuid[]) to anon, authenticated;

-- ─── Earlier guards, hardened ────────────────────────────────────────────────
-- Guards run as the caller, so a subquery on a row RLS hides returns NULL and `<>` never raises.
-- `is distinct from` treats "can't see it" as "doesn't match".
create or replace function public.guard_route_stop() returns trigger
language plpgsql as $$
begin
  if new.trip_id is distinct from (select trip_id from public.routes where id = new.route_id)
     or new.trip_id is distinct from (select trip_id from public.places where id = new.place_id) then
    raise exception 'route stop must belong to the same trip as its route and place' using errcode = '23514';
  end if;
  if new.branch_id is not null and new.route_id is distinct from (select route_id from public.route_branches where id = new.branch_id) then
    raise exception 'route stop branch must belong to the same route' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace function public.guard_route_branch() returns trigger
language plpgsql as $$
begin
  if new.trip_id is distinct from (select trip_id from public.routes where id = new.route_id)
     or new.route_id is distinct from (select route_id from public.route_stops where id = new.split_after_stop_id) then
    raise exception 'branch must belong to the same trip and route as the stop it splits from' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace function public.guard_route_branch_traveler() returns trigger
language plpgsql as $$
begin
  if new.trip_id is distinct from (select trip_id from public.route_branches where id = new.branch_id)
     or new.trip_id is distinct from (select trip_id from public.travelers where id = new.traveler_id) then
    raise exception 'branch traveler must belong to the same trip as the branch' using errcode = '23514';
  end if;
  return new;
end $$;

-- ─── Atlas Premium Pass entitlements ─────────────────────────────────────────
create type public.pass_kind as enum ('trip', 'monthly', 'yearly', 'gift');
create table public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        public.pass_kind not null,
  trip_id     uuid references public.trips(id) on delete set null,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  gifted_by   uuid references public.profiles(id) on delete set null,
  source      text check (source is null or char_length(source) <= 40),
  created_at  timestamptz not null default now(),
  constraint entitlements_window check (ends_at > starts_at)
);
create index entitlements_user_idx on public.entitlements(user_id, ends_at desc);
alter table public.entitlements enable row level security;
-- Users read their own passes. Rows are written by the purchase webhook (service role), never by clients.
create policy entitlements_select on public.entitlements for select to authenticated using (user_id = auth.uid());
revoke all on public.entitlements from anon;

-- Export includes the new tables.
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
    'exported_at', now()
  );
$$;
