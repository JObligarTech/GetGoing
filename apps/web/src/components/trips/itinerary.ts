import { tripDates, type Trip } from "@voya/core";

export interface ItinerarySegment { label: string; city: string; detail: string }

/**
 * Preview segments ("Day 1–5 · Tokyo") derived from the trip's cities and dates
 * when no explicit day plan exists: days are split evenly across cities.
 */
export function previewSegments(trip: Pick<Trip, "cities" | "start_date" | "end_date">, placeNamesByCity: Record<string, string[]> = {}): ItinerarySegment[] {
  const days = tripDates(trip).length;
  const cities = trip.cities.length ? trip.cities : ["Trip"];
  if (!days) return cities.map((c) => ({ label: "—", city: c, detail: placeNamesByCity[c]?.slice(0, 4).join(" · ") || "No dates yet" }));
  const per = Math.max(1, Math.floor(days / cities.length));
  let start = 1;
  return cities.map((c, i) => {
    const end = i === cities.length - 1 ? days : Math.min(days, start + per - 1);
    const label = start === end ? `Day ${start}` : `Day ${start}–${end}`;
    const seg = { label, city: c, detail: placeNamesByCity[c]?.slice(0, 4).join(" · ") || `${end - start + 1} days` };
    start = end + 1;
    return seg;
  });
}
