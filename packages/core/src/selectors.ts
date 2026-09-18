/**
 * "Voya already knows" — pure functions that derive trip context for every tool.
 * No I/O; fully unit-tested.
 */
import { categoryColors } from "@voya/tokens";
import type { Category, ItineraryItem, MapPin, Place, Stay, Trip, TripBundle } from "./domain";

const DAY_MS = 86_400_000;

/** Calendar date (YYYY-MM-DD) in a given IANA time zone. */
export function localDate(at: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function utcDay(d: string): number {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day) / DAY_MS;
}

/** Whole days until the trip starts (negative once started). */
export function daysUntil(trip: Pick<Trip, "start_date">, now: Date, tz = "UTC"): number | null {
  if (!trip.start_date) return null;
  return utcDay(trip.start_date) - utcDay(localDate(now, tz));
}

/** Countdown label as shown on Home: "12 days away", "Today", "Day 3", "Ended". */
export function tripPhaseLabel(trip: Pick<Trip, "start_date" | "end_date">, now: Date, tz = "UTC"): string {
  if (!trip.start_date) return "No dates yet";
  const d = daysUntil(trip, now, tz)!;
  if (d > 1) return `${d} days away`;
  if (d === 1) return "Tomorrow";
  if (d === 0) return "Today";
  if (trip.end_date && utcDay(localDate(now, tz)) > utcDay(trip.end_date)) return "Ended";
  return `Day ${1 - d}`;
}

/** Day number (1-based) for a calendar date within the trip, or null if outside. */
export function tripDayNumber(trip: Pick<Trip, "start_date" | "end_date">, date: string): number | null {
  if (!trip.start_date) return null;
  const n = utcDay(date) - utcDay(trip.start_date) + 1;
  if (n < 1) return null;
  if (trip.end_date && utcDay(date) > utcDay(trip.end_date)) return null;
  return n;
}

export function tripDates(trip: Pick<Trip, "start_date" | "end_date">): string[] {
  if (!trip.start_date || !trip.end_date) return trip.start_date ? [trip.start_date] : [];
  const out: string[] = [];
  for (let d = utcDay(trip.start_date); d <= utcDay(trip.end_date); d++) out.push(new Date(d * DAY_MS).toISOString().slice(0, 10));
  return out;
}

/** The stay that applies on a given date (multi-hotel trips). Falls back to the first stay. */
export function stayForDate(stays: Stay[], date: string): Stay | null {
  const day = utcDay(date);
  const hit = stays.find((s) => {
    if (!s.check_in) return false;
    const ci = utcDay(s.check_in.slice(0, 10));
    const co = s.check_out ? utcDay(s.check_out.slice(0, 10)) : ci + 1;
    return day >= ci && day < co;
  });
  return hit ?? stays[0] ?? null;
}

export function placeById(bundle: Pick<TripBundle, "places">, id: string | null): Place | null {
  return id ? bundle.places.find((p) => p.id === id) ?? null : null;
}

export function categoriesForPlace(bundle: Pick<TripBundle, "categories" | "placeCategories">, placeId: string): Category[] {
  const ids = bundle.placeCategories.filter((pc) => pc.place_id === placeId).map((pc) => pc.category_id);
  return bundle.categories.filter((c) => ids.includes(c.id));
}

/** Colour used for a place's dot, pin and lettered tile: first category, else priority. */
export function placeColor(bundle: Pick<TripBundle, "categories" | "placeCategories">, place: Place): string {
  const cat = categoriesForPlace(bundle, place.id)[0];
  if (cat) return cat.color;
  return place.priority === "must" ? categoryColors.must : categoryColors.unscheduled;
}

export function itemsForDay(bundle: Pick<TripBundle, "itinerary">, day: string): ItineraryItem[] {
  return bundle.itinerary.filter((i) => i.day === day).sort((a, b) => a.sort_order - b.sort_order || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
}

/** Places saved but not on any day. */
export function unscheduledPlaces(bundle: Pick<TripBundle, "places" | "itinerary" | "stays">): Place[] {
  const used = new Set(bundle.itinerary.map((i) => i.place_id).filter(Boolean));
  const stayPlaces = new Set(bundle.stays.map((s) => s.place_id));
  return bundle.places.filter((p) => !used.has(p.id) && !stayPlaces.has(p.id));
}

/** Pins for a map: the stay (dark pill) plus the day's scheduled places. */
export function dayPins(bundle: TripBundle, day: string): MapPin[] {
  const pins: MapPin[] = [];
  const stay = stayForDate(bundle.stays, day);
  const hotel = stay ? placeById(bundle, stay.place_id) : null;
  if (hotel?.lat != null && hotel.lng != null) pins.push({ id: hotel.id, lat: hotel.lat, lng: hotel.lng, label: hotel.name, color: categoryColors.stay, dark: true });
  for (const item of itemsForDay(bundle, day)) {
    const p = placeById(bundle, item.place_id);
    if (p?.lat != null && p.lng != null) pins.push({ id: p.id, lat: p.lat, lng: p.lng, label: p.name, color: placeColor(bundle, p) });
  }
  return pins;
}

export function boundsOf(pins: { lat: number; lng: number }[]): { center: { lat: number; lng: number }; span: number } | null {
  if (!pins.length) return null;
  const lats = pins.map((p) => p.lat), lngs = pins.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return { center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }, span: Math.max(maxLat - minLat, maxLng - minLng) };
}

/** Haversine distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough walking minutes at 80 m/min. */
export function walkMinutes(km: number): number {
  return Math.max(1, Math.round((km * 1000) / 80));
}

/** Unscheduled places near the previous stop — the "fits the 13:00 slot" suggestions. */
export function suggestionsForSlot(bundle: TripBundle, day: string, slotIndex: number, limit = 3): { place: Place; fromName: string; minutes: number }[] {
  const items = itemsForDay(bundle, day);
  const prev = [...items.slice(0, slotIndex)].reverse().map((i) => placeById(bundle, i.place_id)).find((p) => p?.lat != null);
  const anchor = prev ?? (stayForDate(bundle.stays, day) ? placeById(bundle, stayForDate(bundle.stays, day)!.place_id) : null);
  if (!anchor || anchor.lat == null || anchor.lng == null) return [];
  return unscheduledPlaces(bundle)
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ place: p, fromName: anchor.name, minutes: walkMinutes(distanceKm({ lat: anchor.lat!, lng: anchor.lng! }, { lat: p.lat!, lng: p.lng! })) }))
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, limit);
}

/** First letter for lettered tiles ("J" for Japan 2027). */
export function initial(name: string): string {
  return (name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? "?").toUpperCase();
}

/** Trip status derived from dates (persisted `status` is a manual override for drafts). */
export function deriveStatus(trip: Pick<Trip, "start_date" | "end_date" | "status">, now: Date, tz = "UTC"): Trip["status"] {
  if (trip.status === "draft" || !trip.start_date) return "draft";
  const today = utcDay(localDate(now, tz));
  if (today < utcDay(trip.start_date)) return "upcoming";
  if (trip.end_date && today > utcDay(trip.end_date)) return "past";
  return "active";
}

/** Pick the trip Home should show: active, else soonest upcoming, else most recent past. */
export function pickActiveTrip<T extends Pick<Trip, "id" | "start_date" | "end_date" | "status">>(trips: T[], now: Date, tz = "UTC"): T | null {
  const withStatus = trips.map((t) => ({ t, s: deriveStatus(t, now, tz) }));
  const active = withStatus.find((x) => x.s === "active");
  if (active) return active.t;
  const upcoming = withStatus.filter((x) => x.s === "upcoming").sort((a, b) => a.t.start_date!.localeCompare(b.t.start_date!));
  if (upcoming[0]) return upcoming[0].t;
  const past = withStatus.filter((x) => x.s === "past").sort((a, b) => b.t.end_date!.localeCompare(a.t.end_date!));
  return past[0]?.t ?? trips[0] ?? null;
}
