import "server-only";
import { cookies } from "next/headers";
import { demoBundle, demoTrips, type ItineraryItem, type RouteInput, type TripBundle, type TripInput, type TripListItem } from "@voya/core";

/**
 * In-memory demo data so create/assign flows work end-to-end without Supabase.
 * State is keyed by a per-browser demo session id (cookie set at demo sign-in), so
 * parallel users/tests are isolated from each other — the same guarantee RLS gives
 * the real backend. Resets on server restart; capped to bound memory.
 */
export const DEMO_SID_COOKIE = "voya_demo_sid";
const MAX_SESSIONS = 200;

interface DemoState { trips: TripListItem[]; bundles: Map<string, TripBundle> }
const sessions = new Map<string, DemoState>();

function fresh(): DemoState {
  return { trips: structuredClone(demoTrips), bundles: new Map([[demoBundle.trip.id, structuredClone(demoBundle)]]) };
}

async function state(): Promise<DemoState> {
  const sid = (await cookies()).get(DEMO_SID_COOKIE)?.value ?? "anonymous";
  let s = sessions.get(sid);
  if (!s) {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!); // drop oldest
    s = fresh();
    sessions.set(sid, s);
  }
  return s;
}

export const demoStore = {
  trips: async () => (await state()).trips,
  bundle: async (id: string) => (await state()).bundles.get(id) ?? null,

  async createTrip(input: TripInput, ownerId: string): Promise<TripListItem> {
    const s = await state();
    const id = crypto.randomUUID();
    const ts = new Date().toISOString();
    const trip: TripListItem = {
      id, owner_id: ownerId, name: input.name, cover_letter: input.name[0]!.toUpperCase(),
      countries: input.countries, cities: input.cities, start_date: input.startDate, end_date: input.endDate,
      status: input.startDate ? "upcoming" : "draft", local_currency: input.localCurrency, local_tz: input.localTz,
      local_language: input.localLanguage, notes: input.notes, created_at: ts, updated_at: ts, traveler_count: 1, place_count: 0,
    };
    s.trips.push(trip);
    s.bundles.set(id, {
      trip, travelers: [{ id: crypto.randomUUID(), trip_id: id, user_id: ownerId, name: "Joe Obligar", color: "#2F5D3A", created_at: ts }],
      categories: [], places: [], placeCategories: [], stays: [], itinerary: [], routes: [], routeStops: [],
    });
    return trip;
  },

  async saveRoute(tripId: string, input: Omit<RouteInput, "tripId">, userId: string) {
    const b = (await state()).bundles.get(tripId);
    if (!b) return null;
    const id = crypto.randomUUID(), ts = new Date().toISOString();
    b.routes.push({ id, trip_id: tripId, name: input.name, day: input.day, mode: input.mode, notes: null, created_by: userId, created_at: ts, updated_at: ts });
    input.stops.forEach((s, i) => b.routeStops.push({ id: crypto.randomUUID(), route_id: id, trip_id: tripId, place_id: s.placeId, sort_order: i, planned_time: s.plannedTime, dwell_min: null, mode: null, parent_stop_id: null, created_at: ts }));
    return id;
  },

  async assignPlaceToSlot(tripId: string, itemId: string, placeId: string): Promise<ItineraryItem | null> {
    const b = (await state()).bundles.get(tripId);
    const item = b?.itinerary.find((i) => i.id === itemId);
    if (!b || !item || !b.places.some((p) => p.id === placeId)) return null;
    item.place_id = placeId;
    item.note = item.title ? `Was: ${item.title}` : item.note;
    return item;
  },
};
