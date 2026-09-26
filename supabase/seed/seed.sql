-- Demo data mirroring the mockups: Joe, "Japan 2027", Hotel Gracery, today's places.
-- Only for local dev (`supabase db reset`). Never run against production.

-- Demo user (password: VoyaDemo-2027!) — local only.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (
  '11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'joe@example.com', crypt('VoyaDemo-2027!', gen_salt('bf')), now(),
  '{"display_name":"Joe Obligar"}', now(), now()
);
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'email',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"joe@example.com"}', now(), now(), now());

update public.profiles set home_currency = 'USD', home_tz = 'America/Los_Angeles'
where id = '11111111-1111-4111-8111-111111111111';

-- Trips
insert into public.trips (id, owner_id, name, countries, cities, start_date, end_date, status, local_currency, local_tz, local_language)
values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Japan 2027', '{JP}', '{Tokyo,Kyoto,Osaka}', '2027-03-15', '2027-03-29', 'upcoming', 'JPY', 'Asia/Tokyo', 'ja'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Lisbon 2026', '{PT}', '{Lisbon}', '2026-06-03', '2026-06-10', 'past', 'EUR', 'Europe/Lisbon', 'pt'),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 'Bali', '{ID}', '{Ubud,Canggu}', null, null, 'draft', 'IDR', 'Asia/Makassar', 'id');

-- Extra travelers on Japan (no accounts)
insert into public.travelers (trip_id, name, color) values
  ('22222222-2222-4222-8222-222222222221', 'Chris', '#E0703A'),
  ('22222222-2222-4222-8222-222222222221', 'Daniel', '#5568C9'),
  ('22222222-2222-4222-8222-222222222221', 'Sarah', '#C9516F'),
  ('22222222-2222-4222-8222-222222222222', 'Sarah', '#C9516F');

-- Categories for Japan
insert into public.categories (id, trip_id, name, icon, color, sort_order) values
  ('33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222221', 'Coffee', 'coffee', '#E0A020', 1),
  ('33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222221', 'Food', 'utensils', '#E0703A', 2),
  ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222221', 'Sights', 'landmark', '#2F5D3A', 3),
  ('33333333-3333-4333-8333-333333333334', '22222222-2222-4222-8222-222222222221', 'Must visit', 'star', '#2F5D3A', 0),
  ('33333333-3333-4333-8333-333333333335', '22222222-2222-4222-8222-222222222221', 'Shops', 'shopping-bag', '#5568C9', 4);

-- Places (Tokyo)
insert into public.places (id, trip_id, name, local_name, address, local_address, lat, lng, provider, priority) values
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221', 'Hotel Gracery Shinjuku', 'ホテルグレイスリー新宿', '1-19-1 Kabukicho, Shinjuku City, Tokyo 160-8466', '〒160-8466 東京都新宿区歌舞伎町1-19-1', 35.6951, 139.7006, 'manual', 'must'),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222221', 'Fuglen Tokyo', 'フグレン トウキョウ', '1-2-10 Tomigaya, Shibuya City, Tokyo', '東京都渋谷区富ヶ谷1-2-10', 35.6690, 139.6893, 'manual', 'maybe'),
  ('44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222221', 'Meiji Jingu', '明治神宮', '1-1 Yoyogikamizonocho, Shibuya City, Tokyo', '東京都渋谷区代々木神園町1-1', 35.6764, 139.6993, 'manual', 'must'),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222221', 'Shibuya Sky', '渋谷スカイ', '2-1-1 Shibuya, Shibuya City, Tokyo', '東京都渋谷区渋谷2-1-1', 35.6586, 139.7022, 'manual', 'must'),
  ('44444444-4444-4444-8444-444444444445', '22222222-2222-4222-8222-222222222221', 'Afuri Ramen Harajuku', 'AFURI 原宿', '3-63-1 Sendagaya, Shibuya City, Tokyo', '東京都渋谷区千駄ヶ谷3-63-1', 35.6706, 139.7059, 'manual', 'must'),
  ('44444444-4444-4444-8444-444444444446', '22222222-2222-4222-8222-222222222221', 'Cafe Kitsuné', 'カフェ キツネ', '4-3-5 Minamiaoyama, Minato City, Tokyo', '東京都港区南青山4-3-5', 35.6668, 139.7140, 'manual', 'maybe'),
  ('44444444-4444-4444-8444-444444444447', '22222222-2222-4222-8222-222222222221', 'Pokémon Center Shibuya', 'ポケモンセンターシブヤ', 'Shibuya PARCO 6F, 15-1 Udagawacho', '東京都渋谷区宇田川町15-1', 35.6620, 139.6987, 'manual', 'maybe');

insert into public.place_categories (place_id, category_id) values
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333331'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333334'),
  ('44444444-4444-4444-8444-444444444445', '33333333-3333-4333-8333-333333333332'),
  ('44444444-4444-4444-8444-444444444446', '33333333-3333-4333-8333-333333333331'),
  ('44444444-4444-4444-8444-444444444447', '33333333-3333-4333-8333-333333333335');

insert into public.stays (trip_id, place_id, kind, check_in, check_out, confirmation) values
  ('22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444441', 'hotel', '2027-03-15 15:00+09', '2027-03-20 11:00+09', 'GRC-884120');

-- Day 1 itinerary with an open slot at 13:00
insert into public.itinerary_items (trip_id, place_id, day, start_time, title, note, sort_order) values
  ('22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444442', '2027-03-15', '09:00', null, '12 min walk', 1),
  ('22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444443', '2027-03-15', '11:30', null, '15 min walk', 2),
  ('22222222-2222-4222-8222-222222222221', null, '2027-03-15', '13:00', 'Harajuku lunch', 'Open slot', 3),
  ('22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444444', '2027-03-15', '16:30', null, 'Tickets booked', 4),
  ('22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444445', '2027-03-15', '19:30', null, 'Dinner · reserved for 4', 5);

-- Saved routes on Japan 2027
insert into public.routes (id, trip_id, name, day, mode, created_by) values
  ('55555555-5555-4555-8555-555555555551', '22222222-2222-4222-8222-222222222221', 'Morning Shibuya', '2027-03-15', 'walk', '11111111-1111-4111-8111-111111111111'),
  ('55555555-5555-4555-8555-555555555552', '22222222-2222-4222-8222-222222222221', 'Airport → Hotel', '2027-03-15', 'transit', '11111111-1111-4111-8111-111111111111');
insert into public.route_stops (route_id, trip_id, place_id, sort_order, planned_time) values
  ('55555555-5555-4555-8555-555555555551', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444441', 0, '08:40'),
  ('55555555-5555-4555-8555-555555555551', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444442', 1, '09:00'),
  ('55555555-5555-4555-8555-555555555551', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444444', 2, '10:15'),
  ('55555555-5555-4555-8555-555555555551', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444445', 3, '12:00'),
  ('55555555-5555-4555-8555-555555555552', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444441', 0, null);

-- A navigation tree: everyone leaves the hotel, Group A and Group B split, all meet for dinner.
insert into public.routes (id, trip_id, name, day, mode, created_by) values
  ('55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222221', 'Shibuya afternoon', '2027-03-15', 'transit', '11111111-1111-4111-8111-111111111111');
insert into public.route_stops (id, route_id, trip_id, place_id, sort_order, planned_time, dwell_min, mode) values
  ('66666666-6666-4666-8666-666666666661', '55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444441', 0, '14:30', null, null),
  ('66666666-6666-4666-8666-666666666662', '55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444445', 1, '19:30', null, null),
  ('66666666-6666-4666-8666-666666666663', '55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444444', 0, null, 90, 'transit'),
  ('66666666-6666-4666-8666-666666666664', '55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444447', 0, null, 60, 'walk');
insert into public.route_branches (id, route_id, trip_id, name, color, sort_order, split_after_stop_id, merge_mode) values
  ('77777777-7777-4777-8777-777777777771', '55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222221', 'Group A', '#2F5D3A', 0, '66666666-6666-4666-8666-666666666661', 'transit'),
  ('77777777-7777-4777-8777-777777777772', '55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222221', 'Group B', '#F2B233', 1, '66666666-6666-4666-8666-666666666661', 'walk');
update public.route_stops set branch_id = '77777777-7777-4777-8777-777777777771' where id = '66666666-6666-4666-8666-666666666663';
update public.route_stops set branch_id = '77777777-7777-4777-8777-777777777772' where id = '66666666-6666-4666-8666-666666666664';
insert into public.route_branch_travelers (branch_id, traveler_id, trip_id)
  select '77777777-7777-4777-8777-777777777771', id, trip_id from public.travelers where trip_id = '22222222-2222-4222-8222-222222222221' and name in ('Joe Obligar', 'Sarah');
insert into public.route_branch_travelers (branch_id, traveler_id, trip_id)
  select '77777777-7777-4777-8777-777777777772', id, trip_id from public.travelers where trip_id = '22222222-2222-4222-8222-222222222221' and name in ('Chris', 'Daniel');

-- Saved phrases and the extra currency on Japan 2027
insert into public.phrases (id, trip_id, source_text, source_lang, target_text, target_lang, romanized, sort_order, created_by) values
  ('88888888-8888-4888-8888-888888888881', '22222222-2222-4222-8222-222222222221', 'Where is the station?', 'en', '駅はどこですか？', 'ja', 'Eki wa doko desu ka?', 0, '11111111-1111-4111-8111-111111111111'),
  ('88888888-8888-4888-8888-888888888882', '22222222-2222-4222-8222-222222222221', 'No peanuts, please', 'en', 'ピーナッツ抜きでお願いします', 'ja', 'Pīnattsu nuki de onegaishimasu', 1, '11111111-1111-4111-8111-111111111111'),
  ('88888888-8888-4888-8888-888888888883', '22222222-2222-4222-8222-222222222221', 'Table for four', 'en', '4人です', 'ja', 'Yonin desu', 2, '11111111-1111-4111-8111-111111111111');
insert into public.trip_currencies (trip_id, code, label, sort_order) values
  ('22222222-2222-4222-8222-222222222221', 'KRW', 'KRW · Seoul layover', 0);

-- Guest details on Japan 2027 (People round)
update public.travelers set email = 'chris@example.com' where trip_id = '22222222-2222-4222-8222-222222222221' and name = 'Chris';
update public.travelers set home_currency = 'CAD', joining_start = '2027-03-15', joining_end = '2027-03-20', joining_note = 'Tokyo only' where trip_id = '22222222-2222-4222-8222-222222222221' and name = 'Daniel';
update public.travelers set phone = '+1 415 555 0142' where trip_id = '22222222-2222-4222-8222-222222222221' and name = 'Sarah';

-- The demo account holds a yearly Atlas Premium Pass so Split is open.
insert into public.entitlements (user_id, kind, starts_at, ends_at, source) values
  ('11111111-1111-4111-8111-111111111111', 'yearly', '2026-09-01', '2027-09-01', 'seed');

-- Tonight's dinner, mid-split (mockup 5b): Joe paid, Chris claimed by link, Daniel opened his, Coke unassigned.
insert into public.bills (id, trip_id, place_id, merchant, currency, status, bill_date, tax_amount, tax_label, receipt_pages, created_by) values
  ('99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221', '44444444-4444-4444-8444-444444444445', 'Afuri Ramen Harajuku', 'JPY', 'open', '2027-03-15', 605, 'Tax 10%', 2, '11111111-1111-4111-8111-111111111111');
insert into public.bill_participants (id, bill_id, trip_id, traveler_id, name, color, home_currency, claim_token, claim_status)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '99999999-9999-4999-8999-999999999991', trip_id, id, 'Joe', '#2F5D3A', 'USD', null, 'none' from public.travelers where trip_id = '22222222-2222-4222-8222-222222222221' and name = 'Joe Obligar';
insert into public.bill_participants (id, bill_id, trip_id, traveler_id, name, color, home_currency, claim_token, claim_status)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '99999999-9999-4999-8999-999999999991', trip_id, id, 'Chris', '#E0703A', 'USD', 'k8fq2demo0000000000000000chris01', 'claimed' from public.travelers where trip_id = '22222222-2222-4222-8222-222222222221' and name = 'Chris';
insert into public.bill_participants (id, bill_id, trip_id, traveler_id, name, color, home_currency, claim_token, claim_status)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '99999999-9999-4999-8999-999999999991', trip_id, id, 'Daniel', '#5568C9', 'CAD', 'k8fq2demo000000000000000daniel01', 'opened' from public.travelers where trip_id = '22222222-2222-4222-8222-222222222221' and name = 'Daniel';
insert into public.bill_participants (id, bill_id, trip_id, traveler_id, name, color, home_currency, claim_token, claim_status)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '99999999-9999-4999-8999-999999999991', trip_id, id, 'Sarah', '#C9516F', 'USD', null, 'none' from public.travelers where trip_id = '22222222-2222-4222-8222-222222222221' and name = 'Sarah';
update public.bills set paid_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' where id = '99999999-9999-4999-8999-999999999991';
insert into public.bill_items (id, bill_id, trip_id, name, local_name, qty, unit_price, confidence, sort_order) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221', 'Yuzu Shio Ramen', '柚子塩らーめん', 2, 1200, 0.96, 0),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221', 'Gyoza', '餃子', 1, 600, 0.95, 1),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221', 'Draft beer', '生ビール', 2, 700, 0.93, 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221', 'Coke', 'コーラ', 1, 300, 0.97, 3),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221', 'Tsukemen', 'つけ麺', 1, 1350, 0.55, 4);
insert into public.bill_shares (item_id, participant_id, bill_id, trip_id) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '99999999-9999-4999-8999-999999999991', '22222222-2222-4222-8222-222222222221');

-- A settled bill on Lisbon 2026 for "Past splits".
insert into public.bills (id, trip_id, merchant, currency, status, bill_date, service_amount, rounding_unit, receipt_pages, created_by, closed_at) values
  ('99999999-9999-4999-8999-999999999992', '22222222-2222-4222-8222-222222222222', 'Time Out Market', 'EUR', 'settled', '2026-06-05', 15.10, 0.01, 1, '11111111-1111-4111-8111-111111111111', '2026-06-05 21:00+01');
insert into public.bill_participants (id, bill_id, trip_id, traveler_id, name, color, home_currency)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', '99999999-9999-4999-8999-999999999992', trip_id, id, 'Joe', '#2F5D3A', 'USD' from public.travelers where trip_id = '22222222-2222-4222-8222-222222222222' and name = 'Joe Obligar';
insert into public.bill_participants (id, bill_id, trip_id, traveler_id, name, color, home_currency)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', '99999999-9999-4999-8999-999999999992', trip_id, id, 'Sarah', '#C9516F', 'USD' from public.travelers where trip_id = '22222222-2222-4222-8222-222222222222' and name = 'Sarah';
insert into public.bill_participants (id, bill_id, trip_id, name, color, home_currency) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3', '99999999-9999-4999-8999-999999999992', '22222222-2222-4222-8222-222222222222', 'Nuno', '#2B8C8C', 'EUR');
insert into public.bill_items (bill_id, trip_id, name, qty, unit_price, sort_order) values
  ('99999999-9999-4999-8999-999999999992', '22222222-2222-4222-8222-222222222222', 'Bifana', 3, 6.50, 0),
  ('99999999-9999-4999-8999-999999999992', '22222222-2222-4222-8222-222222222222', 'Vinho verde', 2, 7.00, 1),
  ('99999999-9999-4999-8999-999999999992', '22222222-2222-4222-8222-222222222222', 'Pastel de nata', 6, 2.30, 2),
  ('99999999-9999-4999-8999-999999999992', '22222222-2222-4222-8222-222222222222', 'Grilled octopus', 1, 24.00, 3);
update public.bills set paid_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1' where id = '99999999-9999-4999-8999-999999999992';
