import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEMO_NOW, demoBundle, demoTrips, listTrips, loadTripBundle, pickActiveTrip, routeSchema, treeSchema, type RouteInput, type RouteTree, type TripBundle, type TripListItem,
} from "@voya/core";
import { getSupabase, isDemo, prefs } from "./supabase";
import { useSession } from "./session";

interface DataState {
  now: Date;
  trips: TripListItem[];
  active: TripListItem | null;
  bundle: TripBundle | null;
  loading: boolean;
  setActive(id: string): Promise<void>;
  assignPlaceToSlot(itemId: string, placeId: string): Promise<void>;
  /** Save a named multi-stop route on the active trip; resolves the new route id or an error message. */
  saveRoute(input: Omit<RouteInput, "tripId">): Promise<{ id: string } | { error: string }>;
  /** Create or replace a navigation tree on the active trip. */
  saveTree(tree: RouteTree): Promise<{ id: string } | { error: string }>;
  refresh(): Promise<void>;
}

const Ctx = createContext<DataState | null>(null);
/** Demo data is plain JSON; a JSON round-trip is a dependable deep clone on every RN/Jest runtime. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Trip data for the signed-in user; demo mode keeps a mutable in-memory copy. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo] = useState(() => ({ trips: clone(demoTrips), bundles: new Map([[demoBundle.trip.id, clone(demoBundle)]]) }));
  const now = useMemo(() => (isDemo ? DEMO_NOW : new Date()), []);

  /** Pure load step; callers apply the result so state changes always follow an await. */
  const load = useCallback(async () => {
    if (!user) return { trips: [] as TripListItem[], activeId: null as string | null, bundle: null as TripBundle | null };
    const list = isDemo ? demo.trips : await listTrips(await getSupabase());
    const saved = await prefs.get("activeTrip");
    const chosen = list.find((t) => t.id === saved) ?? pickActiveTrip(list, now, user.profile.home_tz);
    const b = chosen ? (isDemo ? demo.bundles.get(chosen.id) ?? null : await loadTripBundle(await getSupabase(), chosen.id)) : null;
    return { trips: list, activeId: chosen?.id ?? null, bundle: b };
  }, [user, demo, now]);
  const apply = useCallback((r: Awaited<ReturnType<typeof load>>) => { setTrips(r.trips); setActiveId(r.activeId); setBundle(r.bundle); setLoading(false); }, []);
  const refresh = useCallback(async () => apply(await load()), [load, apply]);

  useEffect(() => {
    let alive = true;
    load().then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [load, apply]);

  const setActive = useCallback(async (id: string) => {
    if (!trips.some((t) => t.id === id)) return;
    await prefs.set("activeTrip", id);
    await refresh();
  }, [trips, refresh]);

  const assignPlaceToSlot = useCallback(async (itemId: string, placeId: string) => {
    if (!bundle) return;
    if (isDemo) {
      const b = demo.bundles.get(bundle.trip.id);
      const item = b?.itinerary.find((i) => i.id === itemId);
      if (item && b?.places.some((p) => p.id === placeId)) item.place_id = placeId;
    } else {
      await (await getSupabase()).from("itinerary_items").update({ place_id: placeId, note: null }).eq("id", itemId).eq("trip_id", bundle.trip.id);
    }
    await refresh();
  }, [bundle, demo, refresh]);

  const saveRoute = useCallback<DataState["saveRoute"]>(async (input) => {
    if (!bundle || !user) return { error: "No active trip." };
    const parsed = routeSchema.safeParse({ ...input, tripId: bundle.trip.id });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the route." };
    if (!parsed.data.stops.every((s) => bundle.places.some((p) => p.id === s.placeId))) return { error: "One of the stops isn't on this trip." };
    const { tripId, name, day, mode, stops } = parsed.data;
    // Ids are minted here (not read back with RETURNING) so RLS can't refuse the read of a row it just accepted.
    const id = crypto.randomUUID();
    if (isDemo) {
      const b = demo.bundles.get(tripId);
      if (!b) return { error: "No active trip." };
      const ts = new Date().toISOString();
      b.routes.push({ id, trip_id: tripId, name, day, mode, notes: null, created_by: user.id, created_at: ts, updated_at: ts });
      stops.forEach((s, i) => b.routeStops.push({ id: crypto.randomUUID(), route_id: id, trip_id: tripId, place_id: s.placeId, sort_order: i, planned_time: s.plannedTime, dwell_min: null, mode: null, branch_id: null, created_at: ts }));
    } else {
      const db = await getSupabase();
      const { error } = await db.from("routes").insert({ id, trip_id: tripId, name, day, mode, created_by: user.id });
      if (error) return { error: "Couldn't save the route." };
      const { error: e2 } = await db.from("route_stops").insert(stops.map((s, i) => ({ route_id: id, trip_id: tripId, place_id: s.placeId, sort_order: i, planned_time: s.plannedTime })));
      if (e2) return { error: "Couldn't save the stops." };
    }
    await refresh();
    return { id };
  }, [bundle, user, demo, refresh]);

  const saveTree = useCallback<DataState["saveTree"]>(async (tree) => {
    if (!bundle || !user) return { error: "No active trip." };
    const parsed = treeSchema.safeParse({ ...tree, tripId: bundle.trip.id });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the route." };
    const t = parsed.data;
    if (!t.stops.every((s) => bundle.places.some((p) => p.id === s.placeId)) || !t.branches.every((b) => b.travelerIds.every((x) => bundle.travelers.some((tr) => tr.id === x)))) return { error: "One of the stops or travelers isn't on this trip." };
    // Row ids are minted here, never reused from the editor.
    const stopIds = new Map(t.stops.map((s) => [s.id, crypto.randomUUID()]));
    const branchIds = new Map(t.branches.map((b) => [b.id, crypto.randomUUID()]));
    const stops = t.stops.map((s) => ({ ...s, id: stopIds.get(s.id)!, branchId: s.branchId ? branchIds.get(s.branchId)! : null }));
    const branches = t.branches.map((b) => ({ ...b, id: branchIds.get(b.id)!, splitAfterStopId: stopIds.get(b.splitAfterStopId)! }));
    const id = t.routeId ?? crypto.randomUUID();
    if (isDemo) {
      const b = demo.bundles.get(t.tripId);
      if (!b || (t.routeId && !b.routes.some((r) => r.id === t.routeId))) return { error: "Route not found." };
      const ts = new Date().toISOString();
      const old = new Set(b.routeBranches.filter((x) => x.route_id === id).map((x) => x.id));
      b.routeStops = b.routeStops.filter((x) => x.route_id !== id);
      b.routeBranches = b.routeBranches.filter((x) => x.route_id !== id);
      b.routeBranchTravelers = b.routeBranchTravelers.filter((x) => !old.has(x.branch_id));
      if (t.routeId) b.routes = b.routes.map((r) => (r.id === id ? { ...r, name: t.name, day: t.day, mode: t.mode, updated_at: ts } : r));
      else b.routes.push({ id, trip_id: t.tripId, name: t.name, day: t.day, mode: t.mode, notes: null, created_by: user.id, created_at: ts, updated_at: ts });
      for (const s of stops) b.routeStops.push({ id: s.id, route_id: id, trip_id: t.tripId, place_id: s.placeId, sort_order: s.sortOrder, planned_time: s.plannedTime, dwell_min: s.dwellMin, mode: s.mode, branch_id: s.branchId, created_at: ts });
      for (const br of branches) {
        b.routeBranches.push({ id: br.id, route_id: id, trip_id: t.tripId, name: br.name, color: br.color, sort_order: br.sortOrder, split_after_stop_id: br.splitAfterStopId, merge_mode: br.mergeMode, created_at: ts });
        for (const tr of br.travelerIds) b.routeBranchTravelers.push({ branch_id: br.id, traveler_id: tr, trip_id: t.tripId });
      }
    } else {
      const db = await getSupabase();
      const { error } = await db.rpc("save_route_tree", {
        p_route_id: t.routeId, p_trip_id: t.tripId, p_name: t.name, p_day: t.day, p_mode: t.mode,
        p_stops: stops.map((s) => ({ id: s.id, place_id: s.placeId, branch_id: s.branchId, sort_order: s.sortOrder, planned_time: s.plannedTime, dwell_min: s.dwellMin, mode: s.mode })),
        p_branches: branches.map((b) => ({ id: b.id, name: b.name, color: b.color, sort_order: b.sortOrder, split_after_stop_id: b.splitAfterStopId, merge_mode: b.mergeMode, traveler_ids: b.travelerIds })),
      });
      if (error) return { error: "Couldn't save the route." };
    }
    await refresh();
    return { id };
  }, [bundle, user, demo, refresh]);

  const active = trips.find((t) => t.id === activeId) ?? null;
  const value = useMemo<DataState>(() => ({ now, trips, active, bundle, loading, setActive, assignPlaceToSlot, saveRoute, saveTree, refresh }), [now, trips, active, bundle, loading, setActive, assignPlaceToSlot, saveRoute, saveTree, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
