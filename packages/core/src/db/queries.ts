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
  const [trip, travelers, categories, places, placeCats, stays, items, routes, routeStops, branches, branchTravelers, phrases, currencies, invites, bills, billItems, billParticipants, billShares] = await Promise.all([
    db.from("trips").select("*").eq("id", tripId).maybeSingle(),
    db.from("travelers").select("*").eq("trip_id", tripId).order("created_at"),
    db.from("categories").select("*").eq("trip_id", tripId).order("sort_order"),
    db.from("places").select("*").eq("trip_id", tripId).order("name"),
    db.from("place_categories").select("*"),
    db.from("stays").select("*").eq("trip_id", tripId).order("check_in"),
    db.from("itinerary_items").select("*").eq("trip_id", tripId).order("day").order("sort_order"),
    db.from("routes").select("*").eq("trip_id", tripId).order("day", { ascending: true, nullsFirst: false }).order("created_at"),
    db.from("route_stops").select("*").eq("trip_id", tripId).order("sort_order"),
    db.from("route_branches").select("*").eq("trip_id", tripId).order("sort_order"),
    db.from("route_branch_travelers").select("*").eq("trip_id", tripId),
    db.from("phrases").select("*").eq("trip_id", tripId).order("sort_order").order("created_at"),
    db.from("trip_currencies").select("*").eq("trip_id", tripId).order("sort_order"),
    db.from("trip_invites").select("*").eq("trip_id", tripId).is("accepted_at", null),
    db.from("bills").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
    db.from("bill_items").select("*").eq("trip_id", tripId).order("sort_order"),
    db.from("bill_participants").select("*").eq("trip_id", tripId).order("created_at"),
    db.from("bill_shares").select("*").eq("trip_id", tripId),
  ]);
  for (const r of [trip, travelers, categories, places, placeCats, stays, items, routes, routeStops, branches, branchTravelers, phrases, currencies, invites, bills, billItems, billParticipants, billShares]) if (r.error) throw r.error;
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
    routeBranches: branches.data ?? [],
    routeBranchTravelers: branchTravelers.data ?? [],
    phrases: phrases.data ?? [],
    tripCurrencies: currencies.data ?? [],
    tripInvites: invites.data ?? [],
    bills: bills.data ?? [],
    billItems: billItems.data ?? [],
    billParticipants: billParticipants.data ?? [],
    billShares: billShares.data ?? [],
  };
}

/** The caller's Atlas Premium Pass entitlements (RLS: own rows only). */
export async function listEntitlements(db: VoyaClient) {
  const { data, error } = await db.from("entitlements").select("*").order("ends_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Bills across every trip the caller can see, newest first — the Split hub's "Past splits". */
export async function listBills(db: VoyaClient) {
  const { data, error } = await db.from("bills").select("*, trips(name), bill_participants(id)").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (import("./database.types").BillRow & { trips: { name: string } | null; bill_participants: { id: string }[] })[];
  return rows.map(({ trips, bill_participants, ...b }) => ({ ...b, trip_name: trips?.name ?? "Trip", people: bill_participants.length }));
}
export type BillListItem = Awaited<ReturnType<typeof listBills>>[number];

export async function getProfile(db: VoyaClient, userId: string) {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
