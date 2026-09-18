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

  it("delete_my_account removes the user and hands trips to an editor", async () => {
    await as(ALICE);
    await db.query(`select public.delete_my_account()`);
    await superuser();
    expect(await count(`select count(*)::int n from auth.users where id='${ALICE}'`)).toBe(0);
    const { rows } = await db.query(`select owner_id from public.trips where id=$1`, [TRIP]);
    expect(rows[0]?.owner_id).toBe(MALLORY);
  });
});
