/**
 * RLS behaviour tests, run against a real PostgreSQL with the migrations applied.
 * Mirrors supabase/tests/rls.test.sql (pgTAP) so the same guarantees hold on both
 * the local shim and the real Supabase stack.
 */
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.VOYA_TEST_DATABASE_URL;
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MALLORY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TRIP = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe.skipIf(!url)("row level security", () => {
  let db: Client;

  const as = async (uid: string | null) => {
    await db.query(`set role ${uid ? "authenticated" : "anon"}`);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [
      uid ? JSON.stringify({ sub: uid, role: "authenticated" }) : "",
    ]);
  };
  /** An expected failure inside the shared transaction: savepoint, assert the error code, roll back to it. */
  let sp = 0;
  const fails = async (sql: string, params: unknown[], code: string) => {
    const name = `r6_${++sp}`;
    await db.query(`savepoint ${name}`);
    await expect(db.query(sql, params)).rejects.toMatchObject({ code });
    await db.query(`rollback to savepoint ${name}`);
  };
  const asService = async () => {
    await db.query("set role service_role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  };
  const superuser = async () => {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  };
  const count = async (sql: string) => Number((await db.query(sql)).rows[0]?.n ?? 0);

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query("begin");
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
       ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','alice@test.dev','{"display_name":"Alice"}'),
       ($2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','mallory@test.dev','{"display_name":"Mallory"}')`,
      [ALICE, MALLORY],
    );
  });
  afterAll(async () => {
    await db.query("rollback");
    await db.end();
  });

  it("auto-creates profiles for new auth users", async () => {
    expect(await count(`select count(*)::int n from public.profiles where id in ('${ALICE}','${MALLORY}')`)).toBe(2);
  });

  it("owner can create a trip and is auto-added as owner member + traveler", async () => {
    await as(ALICE);
    await db.query(`insert into public.trips (id, owner_id, name) values ($1,$2,'Alice Japan')`, [TRIP, ALICE]);
    expect(await count(`select count(*)::int n from public.trips`)).toBe(1);
    const { rows } = await db.query(`select role from public.trip_members where trip_id=$1 and user_id=$2`, [TRIP, ALICE]);
    expect(rows[0]?.role).toBe("owner");
    expect(await count(`select count(*)::int n from public.travelers where trip_id='${TRIP}'`)).toBe(1);
  });

  it("editor can insert places into their trip", async () => {
    await as(ALICE);
    await db.query(`insert into public.places (trip_id, name, lat, lng) values ($1,'Fuglen',35.669,139.689)`, [TRIP]);
    expect(await count(`select count(*)::int n from public.places`)).toBe(1);
  });

  it("cannot create a trip owned by someone else", async () => {
    await as(ALICE);
    await db.query("savepoint s1");
    await expect(db.query(`insert into public.trips (owner_id, name) values ($1,'Forged')`, [MALLORY])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint s1");
  });

  it("unrelated user sees nothing and cannot write", async () => {
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.trips`)).toBe(0);
    expect(await count(`select count(*)::int n from public.places`)).toBe(0);
    expect(await count(`select count(*)::int n from public.profiles where id='${ALICE}'`)).toBe(0);
    await db.query("savepoint s2");
    await expect(db.query(`insert into public.places (trip_id, name) values ($1,'Injected')`, [TRIP])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint s2");
    await db.query("savepoint s3");
    await expect(
      db.query(`insert into public.trip_members (trip_id, user_id, role) values ($1,$2,'editor')`, [TRIP, MALLORY]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint s3");
  });

  it("anon role has no table access at all", async () => {
    await as(null);
    await db.query("savepoint s4");
    await expect(db.query(`select count(*) from public.trips`)).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint s4");
  });

  it("viewer can read but not write; editor cannot transfer ownership", async () => {
    await as(ALICE);
    await db.query(`insert into public.trip_members (trip_id, user_id, role) values ($1,$2,'viewer')`, [TRIP, MALLORY]);
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.places`)).toBe(1);
    // co-travelers can see each other's profile
    expect(await count(`select count(*)::int n from public.profiles where id='${ALICE}'`)).toBe(1);
    await db.query("savepoint s5");
    await expect(db.query(`update public.places set name='x' where trip_id=$1`, [TRIP])).resolves.toMatchObject({ rowCount: 0 });
    await db.query("rollback to savepoint s5");

    await as(ALICE);
    await db.query(`update public.trip_members set role='editor' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
    await as(MALLORY);
    await db.query("savepoint s6");
    await expect(db.query(`update public.trips set owner_id=$1 where id=$2`, [MALLORY, TRIP])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint s6");
  });

  it("routes: stops must belong to the route's trip; members read, viewers can't write", async () => {
    await as(ALICE);
    const { rows: [route] } = await db.query(`insert into public.routes (trip_id, name, day, mode) values ($1,'Morning',null,'walk') returning id`, [TRIP]);
    const { rows: [place] } = await db.query(`select id from public.places where trip_id=$1 limit 1`, [TRIP]);
    await db.query(`insert into public.route_stops (route_id, trip_id, place_id, sort_order) values ($1,$2,$3,0)`, [route.id, TRIP, place.id]);
    // A second trip owned by alice: a stop can't point its route at a place from another trip.
    // (No RETURNING here: RLS applies the select policy to returned rows before the membership
    // trigger has fired, so a fresh trip can't be read back in the same statement.)
    const OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await db.query(`insert into public.trips (id, owner_id, name) values ($1,$2,'Other')`, [OTHER, ALICE]);
    const { rows: [foreign] } = await db.query(`insert into public.places (trip_id, name) values ($1,'Elsewhere') returning id`, [OTHER]);
    await db.query("savepoint r1");
    await expect(db.query(`insert into public.route_stops (route_id, trip_id, place_id, sort_order) values ($1,$2,$3,1)`, [route.id, TRIP, foreign.id])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to savepoint r1");
    // Mallory is an editor on TRIP (from the earlier test) and can read the route; drop her to viewer → no writes.
    await db.query(`update public.trip_members set role='viewer' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.routes where id='${route.id}'`)).toBe(1);
    await db.query("savepoint r2");
    await expect(db.query(`insert into public.routes (trip_id, name) values ($1,'Sneaky')`, [TRIP])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint r2");
    await as(ALICE);
    await db.query(`update public.trip_members set role='editor' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
  });

  it("seed: the demo tree has two branches with two travelers each", async () => {
    await superuser();
    expect(await count(`select count(*)::int n from public.route_branches where route_id='55555555-5555-4555-8555-555555555553'`)).toBe(2);
    expect(await count(`select count(*)::int n from public.route_branch_travelers where trip_id='22222222-2222-4222-8222-222222222221'`)).toBe(4);
  });

  it("save_route_tree writes a whole tree atomically under RLS; branches can't cross routes or trips", async () => {
    await as(ALICE);
    const { rows: places } = await db.query(`select id from public.places where trip_id=$1 order by name`, [TRIP]);
    const { rows: [trav] } = await db.query(`select id from public.travelers where trip_id=$1 limit 1`, [TRIP]);
    const S1 = "66666666-6666-4666-8666-666666666601", S2 = "66666666-6666-4666-8666-666666666602", S3 = "66666666-6666-4666-8666-666666666603", B1 = "77777777-7777-4777-8777-777777777701";
    const stops = [
      { id: S1, place_id: places[0].id, sort_order: 0, planned_time: "14:30" },
      { id: S2, place_id: places[0].id, sort_order: 1, planned_time: "19:30" },
      { id: S3, place_id: places[0].id, sort_order: 0, branch_id: B1, dwell_min: 60, mode: "walk" },
    ];
    const branches = [{ id: B1, name: "Group A", sort_order: 0, split_after_stop_id: S1, merge_mode: "transit", traveler_ids: [trav.id] }];
    const { rows: [{ save_route_tree: routeId }] } = await db.query(`select public.save_route_tree(null, $1, 'Tree', '2027-03-15', 'transit', $2::jsonb, $3::jsonb)`, [TRIP, JSON.stringify(stops), JSON.stringify(branches)]);
    expect(await count(`select count(*)::int n from public.route_stops where route_id='${routeId}' and branch_id='${B1}'`)).toBe(1);
    expect(await count(`select count(*)::int n from public.route_branch_travelers where branch_id='${B1}'`)).toBe(1);
    // Saving again replaces everything (no duplicates, old branch gone).
    const B2 = "77777777-7777-4777-8777-777777777702";
    await db.query(`select public.save_route_tree($1, $2, 'Tree v2', '2027-03-15', 'walk', $3::jsonb, $4::jsonb)`, [routeId, TRIP, JSON.stringify(stops.map((s) => ({ ...s, branch_id: s.branch_id ? B2 : undefined }))), JSON.stringify([{ ...branches[0], id: B2, traveler_ids: [] }])]);
    expect(await count(`select count(*)::int n from public.route_branches where route_id='${routeId}'`)).toBe(1);
    expect(await count(`select count(*)::int n from public.route_branches where id='${B1}'`)).toBe(0);
    const { rows: [r] } = await db.query(`select name, mode from public.routes where id=$1`, [routeId]);
    expect(r).toEqual({ name: "Tree v2", mode: "walk" });
    // A branch can't split from a stop on another route, and a traveler from another trip can't be assigned.
    const { rows: [other] } = await db.query(`select id from public.route_stops where route_id<>$1 limit 1`, [routeId]);
    await db.query("savepoint t1");
    await expect(db.query(`insert into public.route_branches (route_id, trip_id, name, split_after_stop_id) values ($1,$2,'X',$3)`, [routeId, TRIP, other.id])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to savepoint t1");
    await db.query("savepoint t2");
    await expect(db.query(`insert into public.route_branch_travelers (branch_id, traveler_id, trip_id) select $1, id, $2 from public.travelers where trip_id<>$2 limit 1`, [B2, TRIP])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to savepoint t2");
    // Viewers can read the tree but not save one.
    await db.query(`update public.trip_members set role='viewer' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.route_branches where route_id='${routeId}'`)).toBe(1);
    await db.query("savepoint t3");
    await expect(db.query(`select public.save_route_tree(null, $1, 'Sneaky', null, 'walk', $2::jsonb, '[]'::jsonb)`, [TRIP, JSON.stringify(stops.slice(0, 2))])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint t3");
    await as(ALICE);
    await db.query(`update public.trip_members set role='editor' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
  });

  it("phrases and trip currencies follow trip membership; the export includes them", async () => {
    await as(ALICE);
    await db.query(`insert into public.phrases (trip_id, source_text, source_lang, target_text, target_lang, romanized) values ($1,'Where is the station?','en','駅はどこですか？','ja','Eki wa doko desu ka?')`, [TRIP]);
    await db.query(`insert into public.trip_currencies (trip_id, code, label) values ($1,'KRW','Seoul layover')`, [TRIP]);
    await db.query("savepoint p1");
    await expect(db.query(`insert into public.trip_currencies (trip_id, code) values ($1,'yen')`, [TRIP])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to savepoint p1");
    const { rows: [exp] } = await db.query(`select public.export_my_data() as d`);
    expect(exp.d.phrases).toHaveLength(1);
    expect(exp.d.trip_currencies[0]).toMatchObject({ code: "KRW", label: "Seoul layover" });
    // Mallory is an editor on TRIP: she reads and can add; as a viewer she can only read.
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.phrases where trip_id='${TRIP}'`)).toBe(1);
    await db.query(`insert into public.phrases (trip_id, source_text, source_lang, target_text, target_lang) values ($1,'Thank you','en','ありがとうございます','ja')`, [TRIP]);
    await as(ALICE);
    await db.query(`update public.trip_members set role='viewer' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.phrases where trip_id='${TRIP}'`)).toBe(2);
    await db.query("savepoint p2");
    await expect(db.query(`insert into public.phrases (trip_id, source_text, source_lang, target_text, target_lang) values ($1,'Sneaky','en','x','ja')`, [TRIP])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint p2");
    await expect(db.query(`delete from public.phrases where trip_id=$1`, [TRIP])).resolves.toMatchObject({ rowCount: 0 });
    await as(ALICE);
    await db.query(`update public.trip_members set role='editor' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
  });

  it("seed: Japan 2027 has three saved phrases and a Seoul layover currency", async () => {
    await superuser();
    expect(await count(`select count(*)::int n from public.phrases where trip_id='22222222-2222-4222-8222-222222222221'`)).toBe(3);
    expect(await count(`select count(*)::int n from public.trip_currencies where code='KRW' and trip_id='22222222-2222-4222-8222-222222222221'`)).toBe(1);
  });

  it("invites: a guest joins by link only, becomes a member and takes over their traveler row", async () => {
    await as(ALICE);
    const { rows: [guest] } = await db.query(`insert into public.travelers (trip_id, name, email) values ($1,'Mallory','mallory@test.dev') returning id`, [TRIP]);
    const { rows: [inv] } = await db.query(`insert into public.trip_invites (trip_id, traveler_id, created_by) values ($1,$2,$3) returning token`, [TRIP, guest.id, ALICE]);
    expect(inv.token).toHaveLength(36);
    // Nobody can pick their own token or pretend someone else created the invite.
    await db.query("savepoint i1");
    await expect(db.query(`insert into public.trip_invites (trip_id, created_by) values ($1,$2)`, [TRIP, MALLORY])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint i1");
    // Anonymous preview shows only the trip name, inviter and guest name.
    await as(null);
    const { rows: [prev] } = await db.query(`select public.invite_preview($1) as p`, [inv.token]);
    expect(prev.p).toMatchObject({ trip_name: "Alice Japan", inviter: "Alice", traveler: "Mallory", accepted: false });
    expect(Object.keys(prev.p).sort()).toEqual(["accepted", "expires_at", "inviter", "traveler", "trip_name"]);
    await db.query("savepoint i2");
    await expect(db.query(`select public.accept_trip_invite($1)`, [inv.token])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint i2");
    // Mallory (already an editor from earlier tests) accepts: her traveler row is now hers, the invite is spent.
    await as(MALLORY);
    const { rows: [acc] } = await db.query(`select public.accept_trip_invite($1) as trip`, [inv.token]);
    expect(acc.trip).toBe(TRIP);
    const { rows: [tr] } = await db.query(`select user_id from public.travelers where id = $1`, [guest.id]);
    expect(tr.user_id).toBe(MALLORY);
    await db.query("savepoint i3");
    await expect(db.query(`select public.accept_trip_invite($1)`, [inv.token])).rejects.toMatchObject({ code: "P0002" });
    await db.query("rollback to savepoint i3");
  });

  it("bills: save_bill writes a bill under RLS; claim links work anonymously, token-scoped, and only while open", async () => {
    await as(ALICE);
    const { rows: travs } = await db.query(`select id, name from public.travelers where trip_id = $1 order by created_at`, [TRIP]);
    const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01", P2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02", I1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01", I2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02";
    const bill = { merchant: "Afuri", currency: "JPY", status: "open", tax_amount: 100, tax_label: "Tax 10%", paid_by: P1 };
    const items = [{ id: I1, name: "Ramen", qty: 2, unit_price: 1200, sort_order: 0 }, { id: I2, name: "Gyoza", qty: 1, unit_price: 600, sort_order: 1 }];
    const people = [{ id: P1, traveler_id: travs[0].id, name: "Alice", color: "#2F5D3A" }, { id: P2, traveler_id: null, name: "Guest Gus", color: "#E0703A" }];
    const { rows: [{ save_bill: billId }] } = await db.query(`select public.save_bill(null, $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)`, [TRIP, JSON.stringify(bill), JSON.stringify(items), JSON.stringify(people), JSON.stringify([{ item_id: I1, participant_id: P1 }])]);
    expect(await count(`select count(*)::int n from public.bill_items where bill_id='${billId}'`)).toBe(2);
    const { rows: [b] } = await db.query(`select paid_by, status from public.bills where id=$1`, [billId]);
    expect(b).toEqual({ paid_by: P1, status: "open" });
    // Tokens are issued by the database and can't be changed by a client.
    const { rows: [gus] } = await db.query(`select claim_token from public.bill_participants where id=$1`, [P2]);
    expect(gus.claim_token).toHaveLength(32);
    await db.query("savepoint b1");
    await expect(db.query(`update public.bill_participants set claim_token='chosen' where id=$1`, [P2])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint b1");
    // A share can't join an item from another bill; a participant can't carry a traveler from another trip.
    await db.query("savepoint b2");
    await expect(db.query(`insert into public.bill_shares (item_id, participant_id, bill_id, trip_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', $1, $2, $3)`, [P2, billId, TRIP])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to savepoint b2");
    // The link is dead until the sender shares it.
    await as(null);
    const { rows: [dead] } = await db.query(`select public.bill_claim_view($1) as v`, [gus.claim_token]);
    expect(dead.v).toBeNull();
    await as(ALICE);
    await db.query(`update public.bill_participants set claim_status='sent' where id=$1`, [P2]);
    // Anonymous: the view carries first names and items only, marks the link opened; submit replaces the picks.
    await as(null);
    const { rows: [view] } = await db.query(`select public.bill_claim_view($1) as v`, [gus.claim_token]);
    expect(view.v).toMatchObject({ merchant: "Afuri", currency: "JPY", sender: "Alice", you: { id: P2, name: "Guest" } });
    expect(Object.keys(view.v)).not.toContain("trip_id");
    expect(view.v.participants.map((p: { name: string }) => p.name)).toEqual(["Alice", "Guest"]);
    const { rows: [after] } = await db.query(`select public.bill_claim_submit($1, $2::uuid[]) as v`, [gus.claim_token, [I2, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"]]);
    expect(after.v.shares).toEqual(expect.arrayContaining([{ item_id: I2, participant_id: P2 }]));
    expect(after.v.shares).toHaveLength(2); // the foreign item id was ignored
    await superuser();
    expect((await db.query(`select claim_status from public.bill_participants where id=$1`, [P2])).rows[0].claim_status).toBe("claimed");
    // Anonymous can't read the tables directly, and a wrong token gets nothing.
    await as(null);
    await db.query("savepoint b3");
    await expect(db.query(`select count(*) from public.bill_items`)).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint b3");
    expect((await db.query(`select public.bill_claim_view('nope') as v`)).rows[0].v).toBeNull();
    // Closed bills stop accepting claims.
    await as(ALICE);
    await db.query(`update public.bills set status='settled' where id=$1`, [billId]);
    await as(null);
    await db.query("savepoint b4");
    await expect(db.query(`select public.bill_claim_submit($1, $2::uuid[])`, [gus.claim_token, [I1]])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to savepoint b4");
    // Viewers read bills but can't save one; entitlements are private to their owner.
    await as(ALICE);
    await db.query(`update public.trip_members set role='viewer' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.bills where id='${billId}'`)).toBe(1);
    await db.query("savepoint b5");
    await expect(db.query(`select public.save_bill(null, $1, $2::jsonb, $3::jsonb, $4::jsonb, '[]'::jsonb)`, [TRIP, JSON.stringify(bill), JSON.stringify(items), JSON.stringify(people)])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint b5");
    await db.query("savepoint b6");
    await expect(db.query(`insert into public.entitlements (user_id, kind, ends_at) values ($1, 'yearly', now() + interval '1 year')`, [MALLORY])).rejects.toMatchObject({ code: "42501" });
    await db.query("rollback to savepoint b6");
    expect(await count(`select count(*)::int n from public.entitlements`)).toBe(0); // the seed pass belongs to the demo user, not Mallory
    await as(ALICE);
    await db.query(`update public.trip_members set role='editor' where trip_id=$1 and user_id=$2`, [TRIP, MALLORY]);
  });

  it("seed: the Afuri bill is mid-split and the Lisbon one is settled", async () => {
    await superuser();
    expect(await count(`select count(*)::int n from public.bill_shares where bill_id='99999999-9999-4999-8999-999999999991'`)).toBe(7);
    expect((await db.query(`select status from public.bills where id='99999999-9999-4999-8999-999999999992'`)).rows[0].status).toBe("settled");
    expect((await db.query(`select claim_status from public.bill_participants where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'`)).rows[0].claim_status).toBe("claimed");
  });

  it("profiles carry trip defaults and settings; junk settings are refused", async () => {
    await as(ALICE);
    await db.query(`update public.profiles set units='mi', languages='{en,ja}', settings='{"showHomeTime":false}' where id=$1`, [ALICE]);
    const { rows } = await db.query(`select units, languages, settings from public.profiles where id=$1`, [ALICE]);
    expect(rows[0]).toEqual({ units: "mi", languages: ["en", "ja"], settings: { showHomeTime: false } });
    await fails(`update public.profiles set settings='[1]' where id=$1`, [ALICE], "23514");
    await fails(`update public.profiles set languages='{}' where id=$1`, [ALICE], "23514");
  });

  it("purchases are granted by the service role only, once per receipt; owners read their own", async () => {
    await as(ALICE);
    await fails(`select public.grant_pass($1, 'yearly', null, 'rcpt_1', 'Card ·· 1', 49.99, 'USD', 'test')`, [ALICE], "42501");
    await asService();
    const first = (await db.query(`select public.grant_pass($1, 'yearly', null, 'rcpt_1', 'Card ·· 1', 49.99, 'USD', 'test') id`, [ALICE])).rows[0].id;
    const again = (await db.query(`select public.grant_pass($1, 'yearly', null, 'rcpt_1', 'Card ·· 1', 49.99, 'USD', 'test') id`, [ALICE])).rows[0].id;
    expect(again).toBe(first);
    await fails(`select public.grant_pass($1, 'trip', null, 'rcpt_2', null, 2.99, 'USD', 'test')`, [ALICE], "P0001");
    const tripId = (await db.query(`select public.grant_pass($1, 'trip', $2, 'rcpt_3', 'Card ·· 1', 2.99, 'USD', 'test') id`, [MALLORY, TRIP])).rows[0].id;
    const tripPass = (await db.query(`select * from public.entitlements where id = $1`, [tripId])).rows[0];
    expect(tripPass.trip_id).toBe(TRIP);
    expect(new Date(tripPass.ends_at).getTime() - new Date(tripPass.starts_at).getTime()).toBeGreaterThan(13 * 86_400_000);
    await db.query(`delete from public.entitlements where plan_ref = 'rcpt_3'`); // undated trip → 14 days; not needed below
    await as(ALICE);
    expect(await count(`select count(*)::int n from public.entitlements`)).toBe(1);
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.entitlements`)).toBe(0);
  });

  it("gifts: a Yearly member gifts one traveler per trip; redeeming by code joins the trip for 3 days, once", async () => {
    await as(ALICE);
    const travelerId = (await db.query(`insert into public.travelers (id, trip_id, name) values (gen_random_uuid(), $1, 'Mal') returning id`, [TRIP])).rows[0].id;
    const self = (await db.query(`select id from public.travelers where trip_id=$1 and user_id=$2`, [TRIP, ALICE])).rows[0].id;
    await fails(`select public.create_pass_gift($1, $2)`, [TRIP, self], "P0001");
    const gift = (await db.query(`select public.create_pass_gift($1, $2) g`, [TRIP, travelerId])).rows[0].g;
    expect(gift.code).toMatch(/^[a-f0-9]{24}$/);
    expect(gift.days).toBe(3);
    await fails(`select public.create_pass_gift($1, $2)`, [TRIP, travelerId], "P0001"); // one per trip
    await fails(`insert into public.pass_gifts (trip_id, giver_id, traveler_id) values ($1, $2, $3)`, [TRIP, ALICE, travelerId], "42501"); // RPC only

    await as(null); // the gift page works before signing in, and anon sees nothing else
    const preview = (await db.query(`select public.gift_preview($1) p`, [gift.code])).rows[0].p;
    expect(preview).toMatchObject({ giver_name: "Alice", trip_name: "Alice Japan", traveler_name: "Mal", days: 3, status: "sent", expired: false });
    await fails(`select * from public.pass_gifts`, [], "42501");
    await fails(`select public.redeem_gift($1)`, [gift.code], "42501");

    await as(MALLORY);
    const redeemed = (await db.query(`select public.redeem_gift($1) r`, [gift.code])).rows[0].r;
    expect(redeemed.trip_id).toBe(TRIP);
    expect(new Date(redeemed.ends_at).getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);
    expect((await db.query(`select user_id from public.travelers where id=$1`, [travelerId])).rows[0].user_id).toBe(MALLORY);
    expect((await db.query(`select kind, trip_id, gifted_by from public.entitlements`)).rows).toEqual([{ kind: "gift", trip_id: TRIP, gifted_by: ALICE }]);
    await fails(`select public.redeem_gift($1)`, [gift.code], "P0002");
    const marks = (await db.query(`select * from public.trip_pass_marks($1) order by kind::text`, [TRIP])).rows;
    expect(marks).toEqual([{ user_id: MALLORY, kind: "gift" }, { user_id: ALICE, kind: "yearly" }]);
    expect((await db.query(`select status, recipient_id from public.pass_gifts`)).rows[0]).toEqual({ status: "accepted", recipient_id: MALLORY });
    await as(ALICE);
    await fails(`select public.redeem_gift($1)`, [gift.code], "P0002");
  });

  it("extensions continue from the gift's end for 1–7 days; service role only", async () => {
    await as(MALLORY);
    await fails(`select public.grant_extension($1, $2, 7, 'rcpt_ext', 'Card ·· 1', 'test')`, [MALLORY, TRIP], "42501");
    await asService();
    await fails(`select public.grant_extension($1, $2, 9, 'rcpt_ext', 'Card ·· 1', 'test')`, [MALLORY, TRIP], "P0001");
    await fails(`select public.grant_extension($1, $2, 2, 'rcpt_ext', 'Card ·· 1', 'test')`, [ALICE, TRIP], "P0002"); // nothing gifted to Alice
    const extId = (await db.query(`select public.grant_extension($1, $2, 7, 'rcpt_ext', 'Card ·· 1', 'test') id`, [MALLORY, TRIP])).rows[0].id;
    const ext = (await db.query(`select * from public.entitlements where id = $1`, [extId])).rows[0];
    const giftEnd = (await db.query(`select ends_at from public.entitlements where kind='gift'`)).rows[0].ends_at;
    expect(ext.kind).toBe("extension");
    expect(Math.round((new Date(ext.ends_at).getTime() - new Date(giftEnd).getTime()) / 86_400_000)).toBe(7);
    expect(Number(ext.amount)).toBe(0.99);
    await as(MALLORY);
    expect(await count(`select count(*)::int n from public.entitlements where kind in ('gift','extension')`)).toBe(2);
  });

  it("seed: Chris and Sarah are members with accounts; Sarah holds a pass, Chris does not", async () => {
    await superuser();
    expect(await count(`select count(*)::int n from public.trip_members where trip_id='22222222-2222-4222-8222-222222222221'`)).toBe(3);
    expect((await db.query(`select user_id from public.travelers where trip_id='22222222-2222-4222-8222-222222222221' and name='Chris'`)).rows[0].user_id).toBe("11111111-1111-4111-8111-111111111112");
    expect(await count(`select count(*)::int n from public.entitlements where user_id='11111111-1111-4111-8111-111111111114'`)).toBe(1);
    expect(await count(`select count(*)::int n from public.entitlements where user_id='11111111-1111-4111-8111-111111111112'`)).toBe(0);
  });

  it("delete_my_account removes the user and hands trips to an editor", async () => {
    await as(ALICE);
    await db.query(`select public.delete_my_account()`);
    await superuser();
    expect(await count(`select count(*)::int n from auth.users where id='${ALICE}'`)).toBe(0);
    const { rows } = await db.query(`select owner_id from public.trips where id=$1`, [TRIP]);
    expect(rows[0]?.owner_id).toBe(MALLORY);
  });
});
