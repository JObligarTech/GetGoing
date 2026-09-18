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

  it("delete_my_account removes the user and hands trips to an editor", async () => {
    await as(ALICE);
    await db.query(`select public.delete_my_account()`);
    await superuser();
    expect(await count(`select count(*)::int n from auth.users where id='${ALICE}'`)).toBe(0);
    const { rows } = await db.query(`select owner_id from public.trips where id=$1`, [TRIP]);
    expect(rows[0]?.owner_id).toBe(MALLORY);
  });
});
