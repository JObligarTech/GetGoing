import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEMO_NOW, demoEntitlements, listBills, listEntitlements, listTrips, loadTripBundle, pickActiveTrip, type BillListItem, type EntitlementRow, type TripBundle, type TripListItem } from "@voya/core";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const ACTIVE_TRIP_COOKIE = "voya_active_trip";

/** "Now" — fixed in demo mode so countdowns match the mockups deterministically. */
export function now(): Date {
  return isDemo ? DEMO_NOW : new Date();
}

export const getTrips = cache(async (): Promise<TripListItem[]> => {
  if (isDemo) return demoStore.trips();
  const db = await createServerSupabase();
  return listTrips(db);
});

export const getTripBundle = cache(async (tripId: string): Promise<TripBundle | null> => {
  if (isDemo) return demoStore.bundle(tripId);
  const db = await createServerSupabase();
  return loadTripBundle(db, tripId);
});

/** Active trip = user's explicit choice (cookie) if still valid, else the best guess from dates. */
export const getActiveTrip = cache(async (homeTz = "UTC"): Promise<TripListItem | null> => {
  const trips = await getTrips();
  const chosen = (await cookies()).get(ACTIVE_TRIP_COOKIE)?.value;
  return trips.find((t) => t.id === chosen) ?? pickActiveTrip(trips, now(), homeTz);
});

/** The caller's Atlas Premium Pass entitlements. */
export const getEntitlements = cache(async (): Promise<EntitlementRow[]> => {
  if (isDemo) return demoEntitlements;
  const db = await createServerSupabase();
  return listEntitlements(db);
});

/** Bills across every trip the caller can see (the Split hub's history). */
export const getAllBills = cache(async (): Promise<BillListItem[]> => {
  if (isDemo) return demoStore.listBills();
  const db = await createServerSupabase();
  return listBills(db);
});
