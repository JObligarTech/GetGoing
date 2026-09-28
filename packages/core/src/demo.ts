/**
 * In-memory demo bundle identical to supabase/seed/seed.sql. Used when the app runs
 * without Supabase (e2e tests, Storybook-style previews, Expo Go without keys).
 */
import type { TripBundle } from "./domain";
import type { EntitlementRow, PassMarkRow, ProfileRow, TravelerRow, TripRow } from "./db/database.types";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
/** Chris has an account but no pass (the gift recipient in the mockups); Sarah holds her own yearly pass. */
export const DEMO_CHRIS_ID = "11111111-1111-4111-8111-111111111112";
export const DEMO_SARAH_ID = "11111111-1111-4111-8111-111111111114";
export const DEMO_TRIP_ID = "22222222-2222-4222-8222-222222222221";
/** Fixed "now" used by demo mode so countdowns match the mockups (12 days away). */
export const DEMO_NOW = new Date("2027-03-03T05:41:00Z");

export const demoProfile: ProfileRow = {
  id: DEMO_USER_ID, display_name: "Joe Obligar", avatar_url: null, home_currency: "USD", home_tz: "America/Los_Angeles",
  locale: "en", theme: "system", marketing_opt_in: false, units: "km", languages: ["en", "tl"], settings: {}, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
};
export const demoChrisProfile: ProfileRow = { ...demoProfile, id: DEMO_CHRIS_ID, display_name: "Chris Park", home_tz: "America/New_York", languages: ["en", "ko"] };
/** Demo sign-ins (password VoyaDemo-2027! for both). Demo mode only; the seed never runs in production. */
export const demoUsers: { id: string; email: string; profile: ProfileRow }[] = [
  { id: DEMO_USER_ID, email: "joe@example.com", profile: demoProfile },
  { id: DEMO_CHRIS_ID, email: "chris@example.com", profile: demoChrisProfile },
];

const ts = "2026-09-01T00:00:00Z";
const trip = (t: Partial<TripRow> & Pick<TripRow, "id" | "name">): TripRow => ({
  owner_id: DEMO_USER_ID, cover_letter: t.name[0]!.toUpperCase(), countries: [], cities: [], start_date: null, end_date: null,
  status: "draft", local_currency: null, local_tz: null, local_language: null, notes: null, created_at: ts, updated_at: ts, ...t,
});

export const demoTrips: (TripRow & { traveler_count: number; place_count: number })[] = [
  { ...trip({ id: DEMO_TRIP_ID, name: "Japan 2027", countries: ["JP"], cities: ["Tokyo", "Kyoto", "Osaka"], start_date: "2027-03-15", end_date: "2027-03-29", status: "upcoming", local_currency: "JPY", local_tz: "Asia/Tokyo", local_language: "ja" }), traveler_count: 4, place_count: 38 },
  { ...trip({ id: "22222222-2222-4222-8222-222222222222", name: "Lisbon 2026", countries: ["PT"], cities: ["Lisbon"], start_date: "2026-06-03", end_date: "2026-06-10", status: "past", local_currency: "EUR", local_tz: "Europe/Lisbon", local_language: "pt" }), traveler_count: 2, place_count: 21 },
  { ...trip({ id: "22222222-2222-4222-8222-222222222223", name: "Bali", countries: ["ID"], cities: ["Ubud", "Canggu"], local_currency: "IDR", local_tz: "Asia/Makassar" }), traveler_count: 1, place_count: 6 },
];

const T = DEMO_TRIP_ID;
const P = (n: number) => `44444444-4444-4444-8444-44444444444${n}`;
const C = (n: number) => `33333333-3333-4333-8333-33333333333${n}`;
const TREE = "55555555-5555-4555-8555-555555555553", BR_A = "77777777-7777-4777-8777-777777777771", BR_B = "77777777-7777-4777-8777-777777777772";
const traveler: TravelerRow = { id: "", trip_id: T, user_id: null, name: "", color: "#2F5D3A", created_at: ts, email: null, phone: null, home_currency: null, joining_start: null, joining_end: null, joining_note: null, updated_at: ts };
export const AFURI_BILL = "99999999-9999-4999-8999-999999999991";
const BP = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${n}`;
const BI = (n: number) => `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${n}`;
const place = (id: string, name: string, local_name: string, address: string, local_address: string, lat: number, lng: number, priority: "must" | "maybe" = "maybe") => ({
  id, trip_id: T, name, local_name, address, local_address, lat, lng, provider: "manual", provider_ref: null, phone: null, website: null,
  hours: null, notes: null, priority, created_by: DEMO_USER_ID, created_at: ts, updated_at: ts,
});

const ent = (e: Partial<EntitlementRow> & Pick<EntitlementRow, "id" | "user_id" | "kind" | "ends_at">): EntitlementRow => ({
  trip_id: null, starts_at: "2026-09-01T00:00:00Z", gifted_by: null, source: "seed", created_at: "2026-09-01T00:00:00Z", gift_id: null, plan_ref: null, paid_with: "Apple Pay ·· 4421", amount: 49.99, currency: "USD", ...e,
});
/** Joe and Sarah hold yearly passes, so Split is open for Joe in demo mode; Chris has none (he's the one Joe gifts). */
export const demoAllEntitlements: EntitlementRow[] = [
  ent({ id: "e1", user_id: DEMO_USER_ID, kind: "yearly", ends_at: "2027-09-01T00:00:00Z" }),
  ent({ id: "e2", user_id: DEMO_SARAH_ID, kind: "yearly", ends_at: "2027-12-01T00:00:00Z", starts_at: "2026-12-01T00:00:00Z", created_at: "2026-12-01T00:00:00Z" }),
];
export const demoEntitlements: EntitlementRow[] = demoAllEntitlements.filter((e) => e.user_id === DEMO_USER_ID);
export function demoPassMarks(entitlements: EntitlementRow[] = demoAllEntitlements, now = DEMO_NOW): PassMarkRow[] {
  const t = now.getTime();
  return entitlements.filter((e) => new Date(e.starts_at).getTime() <= t && new Date(e.ends_at).getTime() > t).map((e) => ({ user_id: e.user_id, kind: e.kind }));
}

/** A settled bill from the Lisbon trip, for the hub's "Past splits". */
export const demoBundle: TripBundle = {
  trip: demoTrips[0]!,
  travelers: [
    { ...traveler, id: "t1", user_id: DEMO_USER_ID, name: "Joe Obligar", color: "#2F5D3A" },
    { ...traveler, id: "t2", user_id: DEMO_CHRIS_ID, name: "Chris", color: "#E0703A", email: "chris@example.com" },
    { ...traveler, id: "t3", name: "Daniel", color: "#5568C9", home_currency: "CAD", joining_start: "2027-03-15", joining_end: "2027-03-20", joining_note: "Tokyo only" },
    { ...traveler, id: "t4", user_id: DEMO_SARAH_ID, name: "Sarah", color: "#C9516F", phone: "+1 415 555 0142" },
  ],
  categories: [
    { id: C(4), trip_id: T, name: "Must visit", icon: "star", color: "#2F5D3A", sort_order: 0, created_at: ts },
    { id: C(1), trip_id: T, name: "Coffee", icon: "coffee", color: "#E0A020", sort_order: 1, created_at: ts },
    { id: C(2), trip_id: T, name: "Food", icon: "utensils", color: "#E0703A", sort_order: 2, created_at: ts },
    { id: C(3), trip_id: T, name: "Sights", icon: "landmark", color: "#2F5D3A", sort_order: 3, created_at: ts },
    { id: C(5), trip_id: T, name: "Shops", icon: "shopping-bag", color: "#5568C9", sort_order: 4, created_at: ts },
  ],
  places: [
    place(P(1), "Hotel Gracery Shinjuku", "ホテルグレイスリー新宿", "1-19-1 Kabukicho, Shinjuku City, Tokyo 160-8466", "〒160-8466 東京都新宿区歌舞伎町1-19-1", 35.6951, 139.7006, "must"),
    place(P(2), "Fuglen Tokyo", "フグレン トウキョウ", "1-2-10 Tomigaya, Shibuya City, Tokyo", "東京都渋谷区富ヶ谷1-2-10", 35.669, 139.6893),
    place(P(3), "Meiji Jingu", "明治神宮", "1-1 Yoyogikamizonocho, Shibuya City, Tokyo", "東京都渋谷区代々木神園町1-1", 35.6764, 139.6993, "must"),
    place(P(4), "Shibuya Sky", "渋谷スカイ", "2-1-1 Shibuya, Shibuya City, Tokyo", "東京都渋谷区渋谷2-1-1", 35.6586, 139.7022, "must"),
    place(P(5), "Afuri Ramen Harajuku", "AFURI 原宿", "3-63-1 Sendagaya, Shibuya City, Tokyo", "東京都渋谷区千駄ヶ谷3-63-1", 35.6706, 139.7059, "must"),
    place(P(6), "Cafe Kitsuné", "カフェ キツネ", "4-3-5 Minamiaoyama, Minato City, Tokyo", "東京都港区南青山4-3-5", 35.6668, 139.714),
    place(P(7), "Pokémon Center Shibuya", "ポケモンセンターシブヤ", "Shibuya PARCO 6F, 15-1 Udagawacho", "東京都渋谷区宇田川町15-1", 35.662, 139.6987),
  ],
  placeCategories: [
    { place_id: P(2), category_id: C(1) }, { place_id: P(3), category_id: C(3) }, { place_id: P(4), category_id: C(4) },
    { place_id: P(5), category_id: C(2) }, { place_id: P(6), category_id: C(1) }, { place_id: P(7), category_id: C(5) },
  ],
  stays: [{ id: "s1", trip_id: T, place_id: P(1), kind: "hotel", check_in: "2027-03-15T06:00:00Z", check_out: "2027-03-20T02:00:00Z", confirmation: "GRC-884120", notes: null, created_at: ts }],
  itinerary: [
    { id: "i1", trip_id: T, place_id: P(2), day: "2027-03-15", start_time: "09:00", end_time: null, title: null, note: "12 min walk", sort_order: 1, created_at: ts },
    { id: "i2", trip_id: T, place_id: P(3), day: "2027-03-15", start_time: "11:30", end_time: null, title: null, note: "15 min walk", sort_order: 2, created_at: ts },
    { id: "i3", trip_id: T, place_id: null, day: "2027-03-15", start_time: "13:00", end_time: null, title: "Harajuku lunch", note: "Open slot", sort_order: 3, created_at: ts },
    { id: "i4", trip_id: T, place_id: P(4), day: "2027-03-15", start_time: "16:30", end_time: null, title: null, note: "Tickets booked", sort_order: 4, created_at: ts },
    { id: "i5", trip_id: T, place_id: P(5), day: "2027-03-15", start_time: "19:30", end_time: null, title: null, note: "Dinner · reserved for 4", sort_order: 5, created_at: ts },
  ],
  routes: [
    { id: "55555555-5555-4555-8555-555555555551", trip_id: T, name: "Morning Shibuya", day: "2027-03-15", mode: "walk", notes: null, created_by: DEMO_USER_ID, created_at: ts, updated_at: ts },
    { id: "55555555-5555-4555-8555-555555555552", trip_id: T, name: "Airport → Hotel", day: "2027-03-15", mode: "transit", notes: null, created_by: DEMO_USER_ID, created_at: ts, updated_at: ts },
    { id: "55555555-5555-4555-8555-555555555553", trip_id: T, name: "Shibuya afternoon", day: "2027-03-15", mode: "transit", notes: null, created_by: DEMO_USER_ID, created_at: ts, updated_at: ts },
  ],
  routeStops: [
    { id: "rs1", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(1), sort_order: 0, planned_time: "08:40", dwell_min: null, mode: null, branch_id: null, created_at: ts },
    { id: "rs2", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(2), sort_order: 1, planned_time: "09:00", dwell_min: 45, mode: null, branch_id: null, created_at: ts },
    { id: "rs3", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(4), sort_order: 2, planned_time: "10:15", dwell_min: 75, mode: null, branch_id: null, created_at: ts },
    { id: "rs4", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(5), sort_order: 3, planned_time: "12:00", dwell_min: null, mode: null, branch_id: null, created_at: ts },
    { id: "rs5", route_id: "55555555-5555-4555-8555-555555555552", trip_id: T, place_id: P(1), sort_order: 0, planned_time: null, dwell_min: null, mode: null, branch_id: null, created_at: ts },
    // "Shibuya afternoon" tree: hotel → (A: Shibuya Sky | B: Pokémon Center) → Afuri
    { id: "66666666-6666-4666-8666-666666666661", route_id: TREE, trip_id: T, place_id: P(1), sort_order: 0, planned_time: "14:30", dwell_min: null, mode: null, branch_id: null, created_at: ts },
    { id: "66666666-6666-4666-8666-666666666662", route_id: TREE, trip_id: T, place_id: P(5), sort_order: 1, planned_time: "19:30", dwell_min: null, mode: null, branch_id: null, created_at: ts },
    { id: "66666666-6666-4666-8666-666666666663", route_id: TREE, trip_id: T, place_id: P(4), sort_order: 0, planned_time: null, dwell_min: 90, mode: "transit", branch_id: BR_A, created_at: ts },
    { id: "66666666-6666-4666-8666-666666666664", route_id: TREE, trip_id: T, place_id: P(7), sort_order: 0, planned_time: null, dwell_min: 60, mode: "walk", branch_id: BR_B, created_at: ts },
  ],
  routeBranches: [
    { id: BR_A, route_id: TREE, trip_id: T, name: "Group A", color: "#2F5D3A", sort_order: 0, split_after_stop_id: "66666666-6666-4666-8666-666666666661", merge_mode: "transit", created_at: ts },
    { id: BR_B, route_id: TREE, trip_id: T, name: "Group B", color: "#F2B233", sort_order: 1, split_after_stop_id: "66666666-6666-4666-8666-666666666661", merge_mode: "walk", created_at: ts },
  ],
  routeBranchTravelers: [
    { branch_id: BR_A, traveler_id: "t1", trip_id: T }, { branch_id: BR_A, traveler_id: "t4", trip_id: T },
    { branch_id: BR_B, traveler_id: "t2", trip_id: T }, { branch_id: BR_B, traveler_id: "t3", trip_id: T },
  ],
  phrases: [
    { id: "88888888-8888-4888-8888-888888888881", trip_id: T, source_text: "Where is the station?", source_lang: "en", target_text: "駅はどこですか？", target_lang: "ja", romanized: "Eki wa doko desu ka?", sort_order: 0, created_by: DEMO_USER_ID, created_at: ts },
    { id: "88888888-8888-4888-8888-888888888882", trip_id: T, source_text: "No peanuts, please", source_lang: "en", target_text: "ピーナッツ抜きでお願いします", target_lang: "ja", romanized: "Pīnattsu nuki de onegaishimasu", sort_order: 1, created_by: DEMO_USER_ID, created_at: ts },
    { id: "88888888-8888-4888-8888-888888888883", trip_id: T, source_text: "Table for four", source_lang: "en", target_text: "4人です", target_lang: "ja", romanized: "Yonin desu", sort_order: 2, created_by: DEMO_USER_ID, created_at: ts },
  ],
  tripCurrencies: [{ trip_id: T, code: "KRW", label: "KRW · Seoul layover", sort_order: 0, created_at: ts }],
  tripInvites: [],
  // Tonight's dinner, mid-split: Joe paid, Chris claimed by link, Daniel opened his link, Coke still unassigned (mockup 5b).
  bills: [{ id: AFURI_BILL, trip_id: T, place_id: P(5), merchant: "Afuri Ramen Harajuku", currency: "JPY", status: "open", bill_date: "2027-03-15", tax_amount: 605, tax_label: "Tax 10%", service_amount: 0, discount_amount: 0, rounding_unit: 1, tax_mode: "proportional", paid_by: BP(1), receipt_pages: 2, created_by: DEMO_USER_ID, created_at: "2027-03-15T10:50:00Z", updated_at: "2027-03-15T10:55:00Z", closed_at: null }],
  billItems: [
    { id: BI(1), bill_id: AFURI_BILL, trip_id: T, name: "Yuzu Shio Ramen", local_name: "柚子塩らーめん", qty: 2, unit_price: 1200, confidence: 0.96, sort_order: 0, created_at: ts },
    { id: BI(2), bill_id: AFURI_BILL, trip_id: T, name: "Gyoza", local_name: "餃子", qty: 1, unit_price: 600, confidence: 0.95, sort_order: 1, created_at: ts },
    { id: BI(3), bill_id: AFURI_BILL, trip_id: T, name: "Draft beer", local_name: "生ビール", qty: 2, unit_price: 700, confidence: 0.93, sort_order: 2, created_at: ts },
    { id: BI(4), bill_id: AFURI_BILL, trip_id: T, name: "Coke", local_name: "コーラ", qty: 1, unit_price: 300, confidence: 0.97, sort_order: 3, created_at: ts },
    { id: BI(5), bill_id: AFURI_BILL, trip_id: T, name: "Tsukemen", local_name: "つけ麺", qty: 1, unit_price: 1350, confidence: 0.55, sort_order: 4, created_at: ts },
  ],
  billParticipants: [
    { id: BP(1), bill_id: AFURI_BILL, trip_id: T, traveler_id: "t1", name: "Joe", color: "#2F5D3A", home_currency: "USD", claim_token: null, claim_status: "none", claim_expires_at: "2027-04-14T10:50:00Z", created_at: ts },
    { id: BP(2), bill_id: AFURI_BILL, trip_id: T, traveler_id: "t2", name: "Chris", color: "#E0703A", home_currency: "USD", claim_token: "k8fq2demo0000000000000000chris01", claim_status: "claimed", claim_expires_at: "2027-04-14T10:50:00Z", created_at: ts },
    { id: BP(3), bill_id: AFURI_BILL, trip_id: T, traveler_id: "t3", name: "Daniel", color: "#5568C9", home_currency: "CAD", claim_token: "k8fq2demo000000000000000daniel01", claim_status: "opened", claim_expires_at: "2027-04-14T10:50:00Z", created_at: ts },
    { id: BP(4), bill_id: AFURI_BILL, trip_id: T, traveler_id: "t4", name: "Sarah", color: "#C9516F", home_currency: "USD", claim_token: null, claim_status: "none", claim_expires_at: "2027-04-14T10:50:00Z", created_at: ts },
  ],
  billShares: [
    { item_id: BI(1), participant_id: BP(1), bill_id: AFURI_BILL, trip_id: T }, { item_id: BI(1), participant_id: BP(4), bill_id: AFURI_BILL, trip_id: T },
    { item_id: BI(2), participant_id: BP(1), bill_id: AFURI_BILL, trip_id: T }, { item_id: BI(2), participant_id: BP(2), bill_id: AFURI_BILL, trip_id: T },
    { item_id: BI(3), participant_id: BP(1), bill_id: AFURI_BILL, trip_id: T }, { item_id: BI(3), participant_id: BP(3), bill_id: AFURI_BILL, trip_id: T },
    { item_id: BI(5), participant_id: BP(2), bill_id: AFURI_BILL, trip_id: T },
  ],
  passGifts: [],
  passMarks: demoPassMarks(),
};

export const demoPastBills = [
  { id: "99999999-9999-4999-8999-999999999992", trip_id: "22222222-2222-4222-8222-222222222222", place_id: null, merchant: "Time Out Market", currency: "EUR", status: "settled" as const, bill_date: "2026-06-05", tax_amount: 0, tax_label: null, service_amount: 15.1, discount_amount: 0, rounding_unit: 0.01, tax_mode: "proportional" as const, paid_by: null, receipt_pages: 1, created_by: DEMO_USER_ID, created_at: "2026-06-05T20:10:00Z", updated_at: "2026-06-05T21:00:00Z", closed_at: "2026-06-05T21:00:00Z", trip_name: "Lisbon 2026", people: 3 },
];

