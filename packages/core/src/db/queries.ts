/**
 * Typed query helpers shared by web and mobile. They take any Supabase client
 * (browser, server, or native) — RLS does the authorization.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TripRow } from "./database.types";
import type { TripBundle } from "../domain";

export type VoyaClient = SupabaseClient<Database>;

export async function listTrips(db: VoyaClient) {
  const { data, error } = await db
    .from("trips")
    .select("*, travelers(count), places(count)")
    .order("start_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  // Aggregate selects aren't typed by supabase-js without generated relationships.
  const rows = data as unknown as (TripRow & { travelers: { count: number }[]; places: { count: number }[] })[];
  return rows.map(({ travelers, places, ...t }) => ({
    ...t,
    traveler_count: travelers[0]?.count ?? 0,
    place_count: places[0]?.count ?? 0,
  }));
}
export type TripListItem = Awaited<ReturnType<typeof listTrips>>[number];

/** Everything the Home/Plan screens need for one trip, in one round-trip each. */
export async function loadTripBundle(db: VoyaClient, tripId: string): Promise<TripBundle | null> {
  const [trip, travelers, categories, places, placeCats, stays, items, routes, routeStops] = await Promise.all([
    db.from("trips").select("*").eq("id", tripId).maybeSingle(),
    db.from("travelers").select("*").eq("trip_id", tripId).order("created_at"),
    db.from("categories").select("*").eq("trip_id", tripId).order("sort_order"),
    db.from("places").select("*").eq("trip_id", tripId).order("name"),
    db.from("place_categories").select("*"),
    db.from("stays").select("*").eq("trip_id", tripId).order("check_in"),
    db.from("itinerary_items").select("*").eq("trip_id", tripId).order("day").order("sort_order"),
    db.from("routes").select("*").eq("trip_id", tripId).order("day", { ascending: true, nullsFirst: false }).order("created_at"),
    db.from("route_stops").select("*").eq("trip_id", tripId).order("sort_order"),
  ]);
  for (const r of [trip, travelers, categories, places, placeCats, stays, items, routes, routeStops]) if (r.error) throw r.error;
  if (!trip.data) return null;
  return {
    trip: trip.data,
    travelers: travelers.data ?? [],
    categories: categories.data ?? [],
    places: places.data ?? [],
    placeCategories: placeCats.data ?? [],
    stays: stays.data ?? [],
    itinerary: items.data ?? [],
    routes: routes.data ?? [],
    routeStops: routeStops.data ?? [],
  };
}

export async function getProfile(db: VoyaClient, userId: string) {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
