import { describe, expect, it } from "vitest";
import { DEMO_NOW, demoBundle, demoTrips } from "./demo";
import {
  dayPins, daysUntil, deriveStatus, initial, itemsForDay, pickActiveTrip, placeColor, stayForDate,
  suggestionsForSlot, tripDayNumber, tripPhaseLabel, unscheduledPlaces, walkMinutes, localDate,
} from "./selectors";

const trip = demoBundle.trip;

describe("countdown", () => {
  it("matches the mockup: 12 days away at the demo moment (Tokyo time)", () => {
    expect(daysUntil(trip, DEMO_NOW, "Asia/Tokyo")).toBe(12);
    expect(tripPhaseLabel(trip, DEMO_NOW, "Asia/Tokyo")).toBe("12 days away");
  });
  it("handles day boundaries per time zone", () => {
    const at = new Date("2027-03-14T20:00:00Z"); // Mar 15 05:00 in Tokyo, still Mar 14 in LA
    expect(tripPhaseLabel(trip, at, "Asia/Tokyo")).toBe("Today");
    expect(tripPhaseLabel(trip, at, "America/Los_Angeles")).toBe("Tomorrow");
    expect(localDate(at, "Asia/Tokyo")).toBe("2027-03-15");
  });
  it("labels days during and after the trip", () => {
    expect(tripPhaseLabel(trip, new Date("2027-03-17T12:00:00Z"), "UTC")).toBe("Day 3");
    expect(tripPhaseLabel(trip, new Date("2027-04-01T12:00:00Z"), "UTC")).toBe("Ended");
    expect(tripPhaseLabel({ start_date: null, end_date: null }, DEMO_NOW)).toBe("No dates yet");
  });
  it("day numbers", () => {
    expect(tripDayNumber(trip, "2027-03-15")).toBe(1);
    expect(tripDayNumber(trip, "2027-03-29")).toBe(15);
    expect(tripDayNumber(trip, "2027-03-30")).toBeNull();
    expect(tripDayNumber(trip, "2027-03-01")).toBeNull();
  });
});

describe("stay for date", () => {
  it("returns the hotel covering the date", () => {
    expect(stayForDate(demoBundle.stays, "2027-03-16")?.confirmation).toBe("GRC-884120");
  });
  it("falls back to the first stay outside any range", () => {
    expect(stayForDate(demoBundle.stays, "2027-03-25")?.id).toBe("s1");
    expect(stayForDate([], "2027-03-25")).toBeNull();
  });
});

describe("plan", () => {
  it("orders Day 1 like the mockup, with the open slot third", () => {
    const items = itemsForDay(demoBundle, "2027-03-15");
    expect(items.map((i) => i.start_time)).toEqual(["09:00", "11:30", "13:00", "16:30", "19:30"]);
    expect(items[2]?.place_id).toBeNull();
    expect(items[2]?.title).toBe("Harajuku lunch");
  });
  it("lists unscheduled places excluding the hotel", () => {
    const names = unscheduledPlaces(demoBundle).map((p) => p.name).sort();
    expect(names).toEqual(["Cafe Kitsuné", "Pokémon Center Shibuya"]);
  });
  it("suggests unscheduled places for the 13:00 slot, nearest first, measured from the previous stop", () => {
    const s = suggestionsForSlot(demoBundle, "2027-03-15", 2);
    expect(s.map((x) => x.place.name).sort()).toEqual(["Cafe Kitsuné", "Pokémon Center Shibuya"]);
    expect(s.every((x) => x.fromName === "Meiji Jingu")).toBe(true);
    expect(s[0]!.minutes).toBeLessThanOrEqual(s[1]!.minutes);
    expect(s[0]!.minutes).toBeGreaterThan(5);
  });
  it("falls back to the hotel as anchor for the first slot", () => {
    const s = suggestionsForSlot(demoBundle, "2027-03-15", 0);
    expect(s[0]?.fromName).toBe("Hotel Gracery Shinjuku");
  });
  it("pins: hotel first as a dark pill, then the day's places in category colour", () => {
    const pins = dayPins(demoBundle, "2027-03-15");
    expect(pins[0]).toMatchObject({ label: "Hotel Gracery Shinjuku", dark: true });
    expect(pins).toHaveLength(5);
    const fuglen = pins.find((p) => p.label === "Fuglen Tokyo");
    expect(fuglen?.color).toBe("#E0A020");
  });
  it("place colour comes from category, then priority", () => {
    const afuri = demoBundle.places.find((p) => p.name.startsWith("Afuri"))!;
    expect(placeColor(demoBundle, afuri)).toBe("#E0703A");
    expect(placeColor({ categories: [], placeCategories: [] }, { ...afuri, priority: "must" })).toBe("#2F5D3A");
  });
  it("walk minutes are rounded and never zero", () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(0.96)).toBe(12);
  });
});

describe("trip status", () => {
  it("derives from dates", () => {
    expect(deriveStatus(trip, DEMO_NOW)).toBe("upcoming");
    expect(deriveStatus(trip, new Date("2027-03-20T00:00:00Z"))).toBe("active");
    expect(deriveStatus(trip, new Date("2027-05-01T00:00:00Z"))).toBe("past");
    expect(deriveStatus(demoTrips[2]!, DEMO_NOW)).toBe("draft");
  });
  it("Home picks the soonest upcoming trip when nothing is active", () => {
    expect(pickActiveTrip(demoTrips, DEMO_NOW)?.name).toBe("Japan 2027");
    expect(pickActiveTrip(demoTrips, new Date("2026-06-05T00:00:00Z"))?.name).toBe("Lisbon 2026");
    expect(pickActiveTrip([], DEMO_NOW)).toBeNull();
  });
});

describe("initial()", () => {
  it("handles unicode and leading symbols", () => {
    expect(initial("Japan 2027")).toBe("J");
    expect(initial("  · Bali")).toBe("B");
    expect(initial("東京")).toBe("東");
    expect(initial("")).toBe("?");
  });
});
