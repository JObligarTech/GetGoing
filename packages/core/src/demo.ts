/**
 * In-memory demo bundle identical to supabase/seed/seed.sql. Used when the app runs
 * without Supabase (e2e tests, Storybook-style previews, Expo Go without keys).
 */
import type { TripBundle } from "./domain";
import type { ProfileRow, TripRow } from "./db/database.types";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_TRIP_ID = "22222222-2222-4222-8222-222222222221";

export const demoProfile: ProfileRow = {
  id: DEMO_USER_ID, display_name: "Joe Obligar", avatar_url: null, home_currency: "USD", home_tz: "America/Los_Angeles",
  locale: "en", theme: "system", marketing_opt_in: false, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
};

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
const place = (id: string, name: string, local_name: string, address: string, local_address: string, lat: number, lng: number, priority: "must" | "maybe" = "maybe") => ({
  id, trip_id: T, name, local_name, address, local_address, lat, lng, provider: "manual", provider_ref: null, phone: null, website: null,
  hours: null, notes: null, priority, created_by: DEMO_USER_ID, created_at: ts, updated_at: ts,
});

export const demoBundle: TripBundle = {
  trip: demoTrips[0]!,
  travelers: [
    { id: "t1", trip_id: T, user_id: DEMO_USER_ID, name: "Joe Obligar", color: "#2F5D3A", created_at: ts },
    { id: "t2", trip_id: T, user_id: null, name: "Chris", color: "#E0703A", created_at: ts },
    { id: "t3", trip_id: T, user_id: null, name: "Daniel", color: "#5568C9", created_at: ts },
    { id: "t4", trip_id: T, user_id: null, name: "Sarah", color: "#C9516F", created_at: ts },
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
  ],
  routeStops: [
    { id: "rs1", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(1), sort_order: 0, planned_time: "08:40", dwell_min: null, mode: null, parent_stop_id: null, created_at: ts },
    { id: "rs2", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(2), sort_order: 1, planned_time: "09:00", dwell_min: 45, mode: null, parent_stop_id: null, created_at: ts },
    { id: "rs3", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(4), sort_order: 2, planned_time: "10:15", dwell_min: 75, mode: null, parent_stop_id: null, created_at: ts },
    { id: "rs4", route_id: "55555555-5555-4555-8555-555555555551", trip_id: T, place_id: P(5), sort_order: 3, planned_time: "12:00", dwell_min: null, mode: null, parent_stop_id: null, created_at: ts },
    { id: "rs5", route_id: "55555555-5555-4555-8555-555555555552", trip_id: T, place_id: P(1), sort_order: 0, planned_time: null, dwell_min: null, mode: null, parent_stop_id: null, created_at: ts },
  ],
};

/** Fixed "now" used by demo mode so countdowns match the mockups (12 days away). */
export const DEMO_NOW = new Date("2027-03-03T05:41:00Z");
