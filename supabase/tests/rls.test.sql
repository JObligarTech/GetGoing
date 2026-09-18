-- pgTAP RLS tests. Run: `supabase test db`
begin;
select plan(12);

-- Two users: alice owns a trip, mallory is unrelated.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','authenticated','authenticated','alice@test.dev','{"display_name":"Alice"}'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mallory@test.dev','{"display_name":"Mallory"}');

select is((select count(*) from public.profiles where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))::int, 2, 'profiles auto-created');

-- Act as alice
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

insert into public.trips (id, owner_id, name) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Alice Japan');
select is((select count(*) from public.trips)::int, 1, 'alice sees her trip');
select is((select role::text from public.trip_members where trip_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'owner', 'owner membership auto-created');
select is((select count(*) from public.travelers where trip_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')::int, 1, 'owner added as traveler');

insert into public.places (trip_id, name, lat, lng) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Fuglen',35.669,139.689);
select is((select count(*) from public.places)::int, 1, 'alice can insert a place');

select throws_ok(
  $$ insert into public.trips (owner_id, name) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Forged') $$,
  '42501', null, 'cannot create a trip owned by someone else');

-- Act as mallory
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select is((select count(*) from public.trips)::int, 0, 'mallory cannot see alice''s trip');
select is((select count(*) from public.places)::int, 0, 'mallory cannot see alice''s places');
select is((select count(*) from public.profiles where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::int, 0, 'mallory cannot see alice''s profile');
select throws_ok(
  $$ insert into public.places (trip_id, name) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Injected') $$,
  '42501', null, 'mallory cannot insert into alice''s trip');
select throws_ok(
  $$ insert into public.trip_members (trip_id, user_id, role) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','editor') $$,
  '42501', null, 'mallory cannot add herself as a member');

-- Alice invites mallory as viewer → mallory can read but not write
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
insert into public.trip_members (trip_id, user_id, role) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','viewer');
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select is((select count(*) from public.places)::int, 1, 'viewer can read places');

select * from finish();
rollback;
