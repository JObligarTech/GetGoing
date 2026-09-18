"use server";
import { revalidatePath } from "next/cache";
import { compareModes, planTree, treeSchema, TRAVEL_MODES, type TravelMode, type TreePlan, type TripBundle } from "@voya/core";
import { getTripBundle } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { routing } from "@/lib/routing";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

type Parsed = ReturnType<typeof treeSchema.parse>;

/** Validate the tree and make sure every place/traveler it references is on the caller's trip. */
async function loadValidTree(input: unknown): Promise<{ tree: Parsed; bundle: TripBundle } | { error: string }> {
  await requireUser();
  const parsed = treeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the route." };
  const bundle = await getTripBundle(parsed.data.tripId);
  if (!bundle) return { error: "Trip not found." };
  const placeOk = parsed.data.stops.every((s) => bundle.places.some((p) => p.id === s.placeId && p.lat != null));
  const travelerOk = parsed.data.branches.every((b) => b.travelerIds.every((t) => bundle.travelers.some((x) => x.id === t)));
  if (!placeOk || !travelerOk) return { error: "One of the stops or travelers isn't on this trip." };
  if (parsed.data.routeId && !bundle.routes.some((r) => r.id === parsed.data.routeId)) return { error: "Route not found." };
  return { tree: parsed.data, bundle };
}

/** Re-route every lane of the tree as it is being edited. */
export async function planTreeAction(input: unknown): Promise<TreePlan | { error: string }> {
  const v = await loadValidTree(input);
  if ("error" in v) return v;
  const currency = v.bundle.trip.local_currency ?? "USD";
  return planTree(v.tree, v.bundle, routing, currency);
}

/** Durations by mode for one segment (the segment sheet's mode picker). */
export async function legModesAction(tripId: string, fromPlaceId: string, toPlaceId: string): Promise<Partial<Record<TravelMode, number>> | { error: string }> {
  await requireUser();
  const bundle = await getTripBundle(tripId);
  const from = bundle?.places.find((p) => p.id === fromPlaceId), to = bundle?.places.find((p) => p.id === toPlaceId);
  if (!bundle || !from || !to || from.lat == null || to.lat == null) return { error: "Not on this trip." };
  const r = await compareModes({ lat: from.lat, lng: from.lng! }, { lat: to.lat, lng: to.lng! }, routing, bundle.trip.local_currency ?? "USD");
  return Object.fromEntries(TRAVEL_MODES.filter((m) => r[m]).map((m) => [m, r[m]!.durationSec]));
}

/** Save (create or replace) the tree. Ids are re-minted here so clients never choose row ids. */
export async function saveTreeAction(input: unknown): Promise<{ ok: true; routeId: string } | { error: string }> {
  const user = await requireUser();
  const v = await loadValidTree(input);
  if ("error" in v) return v;
  const { tree } = v;
  const stopIds = new Map(tree.stops.map((s) => [s.id, crypto.randomUUID()]));
  const branchIds = new Map(tree.branches.map((b) => [b.id, crypto.randomUUID()]));
  const stops = tree.stops.map((s) => ({ ...s, id: stopIds.get(s.id)!, branchId: s.branchId ? branchIds.get(s.branchId)! : null }));
  const branches = tree.branches.map((b) => ({ ...b, id: branchIds.get(b.id)!, splitAfterStopId: stopIds.get(b.splitAfterStopId)! }));

  let routeId: string;
  if (isDemo) {
    const id = await demoStore.saveTree(tree.tripId, { ...tree, stops, branches }, user.id);
    if (!id) return { error: "Couldn't save the route." };
    routeId = id;
  } else {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc("save_route_tree", {
      p_route_id: tree.routeId, p_trip_id: tree.tripId, p_name: tree.name, p_day: tree.day, p_mode: tree.mode,
      p_stops: stops.map((s) => ({ id: s.id, place_id: s.placeId, branch_id: s.branchId, sort_order: s.sortOrder, planned_time: s.plannedTime, dwell_min: s.dwellMin, mode: s.mode })),
      p_branches: branches.map((b) => ({ id: b.id, name: b.name, color: b.color, sort_order: b.sortOrder, split_after_stop_id: b.splitAfterStopId, merge_mode: b.mergeMode, traveler_ids: b.travelerIds })),
    });
    if (error || !data) return { error: "Couldn't save the route." };
    routeId = data;
  }
  revalidatePath("/navigate");
  return { ok: true, routeId };
}
