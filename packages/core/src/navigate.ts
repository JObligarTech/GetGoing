/**
 * Navigate — trip-context shortcuts and day routes. Pure functions over a TripBundle.
 */
import { categoryColors } from "@voya/tokens";
import type { ItineraryItem, LatLng, Place, TripBundle } from "./domain";
import { categoriesForPlace, itemsForDay, placeById, placeColor, stayForDate } from "./selectors";
import { TRAVEL_MODES, type RouteResult, type RoutingProvider, type TravelMode } from "./providers/routing";

export interface NavShortcut {
  key: "hotel" | "dinner" | "next";
  label: string;
  place: Place;
  detail: string;
  time?: string | null;
}

const isFood = (bundle: TripBundle, p: Place) =>
  categoriesForPlace(bundle, p.id).some((c) => /food|dinner|restaurant|ramen/i.test(c.name));

/**
 * "Take me to my hotel", "Tonight's dinner", "Next planned place" — the contextual
 * shortcuts from the brief. `nowHHMM` is local time on the trip ("14:41").
 */
export function navShortcuts(bundle: TripBundle, day: string, nowHHMM: string): NavShortcut[] {
  const out: NavShortcut[] = [];
  const stay = stayForDate(bundle.stays, day);
  const hotel = stay ? placeById(bundle, stay.place_id) : null;
  if (hotel) out.push({ key: "hotel", label: "Take me to my hotel", place: hotel, detail: hotel.name.split(" ").slice(0, 2).join(" ") });

  const items = itemsForDay(bundle, day).filter((i) => i.place_id);
  const withPlace = items.map((i) => ({ i, p: placeById(bundle, i.place_id)! })).filter((x) => x.p);
  const dinner = [...withPlace].reverse().find((x) => isFood(bundle, x.p) && (x.i.start_time ?? "00:00") >= "17:00") ?? [...withPlace].reverse().find((x) => isFood(bundle, x.p));
  if (dinner) out.push({ key: "dinner", label: "Tonight's dinner", place: dinner.p, detail: `${dinner.p.name.split(" ")[0]} · ${dinner.i.start_time ?? ""}`.trim(), time: dinner.i.start_time });

  const next = withPlace.find((x) => (x.i.start_time ?? "") > nowHHMM && x.p.id !== dinner?.p.id) ?? withPlace.find((x) => x.p.id !== dinner?.p.id);
  if (next) out.push({ key: "next", label: "Next planned", place: next.p, detail: `${next.p.name} · ${next.i.start_time ?? ""}`.trim(), time: next.i.start_time });
  return out;
}

export interface DayStop {
  place: Place;
  item: ItineraryItem | null;
  /** planned arrival HH:MM (from the itinerary), null for the hotel bookends */
  time: string | null;
  color: string;
  isHotel: boolean;
}

/** Ordered stops for "Navigate the day": hotel → each scheduled place → hotel. */
export function dayStops(bundle: TripBundle, day: string): DayStop[] {
  const stay = stayForDate(bundle.stays, day);
  const hotel = stay ? placeById(bundle, stay.place_id) : null;
  const items = itemsForDay(bundle, day).filter((i) => i.place_id);
  const mids: DayStop[] = items
    .map((item) => ({ item, place: placeById(bundle, item.place_id) }))
    .filter((x): x is { item: ItineraryItem; place: Place } => !!x.place && x.place.lat != null)
    .map(({ item, place }) => ({ place, item, time: item.start_time, color: placeColor(bundle, place), isHotel: false }));
  if (!hotel || hotel.lat == null) return mids;
  const h: DayStop = { place: hotel, item: null, time: null, color: categoryColors.stay, isHotel: true };
  return [h, ...mids, { ...h }];
}

export interface DayLeg { from: DayStop; to: DayStop; route: RouteResult }
export interface DayRoute {
  stops: DayStop[];
  legs: DayLeg[];
  totalSec: number;
  walkM: number;
  fares: { amount: number; currency: string } | null;
}

/** Route every leg of the day with one mode (walk/transit) and total it up. */
export async function routeDay(stops: DayStop[], provider: RoutingProvider, mode: TravelMode, currency: string): Promise<DayRoute> {
  const legs: DayLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!, b = stops[i + 1]!;
    const route = await provider.route({ lat: a.place.lat!, lng: a.place.lng! }, { lat: b.place.lat!, lng: b.place.lng! }, mode, { currency });
    legs.push({ from: a, to: b, route });
  }
  const totalSec = legs.reduce((s, l) => s + l.route.durationSec, 0);
  const walkM = legs.reduce((s, l) => s + l.route.steps.filter((st) => st.kind === "walk" || st.kind === "turn").reduce((x, st) => x + st.distanceM, 0), 0);
  const fareSum = legs.reduce((s, l) => s + (l.route.fare?.amount ?? 0), 0);
  return { stops, legs, totalSec, walkM, fares: fareSum ? { amount: fareSum, currency } : null };
}

export interface DayTimelineRow { stop: DayStop; arrive: string | null; leave: string; leg: DayLeg | null }

/**
 * Arrival/departure clock for each stop: leave the first stop so the second's planned
 * time is met (or 09:00), then arrive = previous leave + leg, leave = planned time if
 * later, else arrive + dwell (an hour for planned items, none for pass-throughs).
 */
export function dayTimeline(plan: DayRoute, dwellSec = 3600): DayTimelineRow[] {
  const { stops, legs } = plan;
  const leaveAt = stops[1]?.time && legs[0] ? addToClock(stops[1].time, -legs[0].route.durationSec) : "09:00";
  const rows: DayTimelineRow[] = [];
  let clock = leaveAt;
  stops.forEach((s, i) => {
    if (i === 0) { rows.push({ stop: s, arrive: null, leave: leaveAt, leg: null }); return; }
    const leg = legs[i - 1]!;
    const arrive = addToClock(clock, leg.route.durationSec);
    const leave = s.time && s.time > arrive ? s.time : addToClock(arrive, s.item ? dwellSec : 0);
    clock = leave;
    rows.push({ stop: s, arrive, leave, leg });
  });
  return rows;
}

/** Route one origin→destination for every mode, for the compare chips. */
export async function compareModes(from: LatLng, to: LatLng, provider: RoutingProvider, currency: string): Promise<Record<TravelMode, RouteResult | null>> {
  const entries = await Promise.all(TRAVEL_MODES.map(async (m) => [m, await provider.route(from, to, m, { currency }).catch(() => null)] as const));
  return Object.fromEntries(entries) as Record<TravelMode, RouteResult | null>;
}

/** Move an element within an array (for reorder buttons / drag). Returns a new array. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** "18 min", "1 h 25", "4 h 20 min" (long form for totals). */
export function formatDuration(sec: number, long = false): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (!m) return `${h} h`;
  return long ? `${h} h ${m} min` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** "450 m", "3.1 km" */
export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** HH:MM plus seconds → HH:MM (24h, wraps at midnight). */
export function addToClock(hhmm: string, sec: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const total = ((h * 60 + m + Math.round(sec / 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const MODE_LABEL: Record<TravelMode, string> = { walk: "Walk", transit: "Transit", drive: "Drive", cycle: "Cycle" };
