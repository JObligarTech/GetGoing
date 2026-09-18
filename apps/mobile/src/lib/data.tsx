import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEMO_NOW, demoBundle, demoTrips, listTrips, loadTripBundle, pickActiveTrip, type TripBundle, type TripListItem,
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

  const active = trips.find((t) => t.id === activeId) ?? null;
  const value = useMemo<DataState>(() => ({ now, trips, active, bundle, loading, setActive, assignPlaceToSlot, refresh }), [now, trips, active, bundle, loading, setActive, assignPlaceToSlot, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
