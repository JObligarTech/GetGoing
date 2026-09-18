import { describe, expect, it, vi } from "vitest";
import { demoBundle } from "./demo";
import { addToClock, compareModes, dayStops, dayTimeline, formatDistance, formatDuration, moveItem, navShortcuts, routeDay } from "./navigate";
import { createOsrmRouting, mockRouting } from "./providers/routing";

const DAY = "2027-03-15";

describe("navShortcuts", () => {
  it("offers hotel, tonight's dinner and the next planned place", () => {
    const s = navShortcuts(demoBundle, DAY, "14:41");
    expect(s.map((x) => x.key)).toEqual(["hotel", "dinner", "next"]);
    expect(s[0]!.place.name).toBe("Hotel Gracery Shinjuku");
    expect(s[1]!.place.name).toBe("Afuri Ramen Harajuku");
    expect(s[2]!.place.name).toBe("Shibuya Sky"); // 16:30 is the next start after 14:41
  });
  it("falls back to the first place when the day is over", () => {
    expect(navShortcuts(demoBundle, DAY, "23:00")[2]!.place.name).toBe("Fuglen Tokyo");
  });
});

describe("dayStops / routeDay", () => {
  it("bookends the day with the hotel", () => {
    const stops = dayStops(demoBundle, DAY);
    expect(stops[0]!.isHotel && stops.at(-1)!.isHotel).toBe(true);
    expect(stops.map((s) => s.place.name.split(" ")[0])).toEqual(["Hotel", "Fuglen", "Meiji", "Shibuya", "Afuri", "Hotel"]);
  });
  it("totals legs and sums transit fares in the trip currency", async () => {
    const r = await routeDay(dayStops(demoBundle, DAY), mockRouting, "transit", "JPY");
    expect(r.legs).toHaveLength(5);
    expect(r.totalSec).toBe(r.legs.reduce((s, l) => s + l.route.durationSec, 0));
    expect(r.fares?.currency).toBe("JPY");
    expect(r.fares!.amount % 10).toBe(0);
    expect(r.walkM).toBeGreaterThan(0);
  });
  it("builds a timeline that leaves the hotel in time for the first planned stop", async () => {
    const plan = await routeDay(dayStops(demoBundle, DAY), mockRouting, "walk", "JPY");
    const rows = dayTimeline(plan);
    expect(rows).toHaveLength(plan.stops.length);
    expect(rows[0]).toMatchObject({ arrive: null, leg: null });
    expect(rows[1]!.arrive).toBe(plan.stops[1]!.time); // 09:00 at Fuglen, exactly on time
    expect(rows[0]!.leave < rows[1]!.arrive!).toBe(true);
    // Later stops never leave before their planned time, and each arrival follows the previous departure.
    rows.slice(1).forEach((r, i) => {
      if (r.stop.time) expect(r.leave >= r.stop.time).toBe(true);
      expect(r.arrive).toBe(addToClock(rows[i]!.leave, r.leg!.route.durationSec));
    });
  });
});

describe("mockRouting", () => {
  const hotel = { lat: 35.6951, lng: 139.7006 }, fuglen = { lat: 35.669, lng: 139.6893 };
  it("is deterministic and ordered walk > cycle > drive by time", async () => {
    const a = await mockRouting.route(hotel, fuglen, "walk");
    const b = await mockRouting.route(hotel, fuglen, "walk");
    expect(a).toEqual(b);
    const cycle = await mockRouting.route(hotel, fuglen, "cycle");
    const drive = await mockRouting.route(hotel, fuglen, "drive");
    expect(a.durationSec).toBeGreaterThan(cycle.durationSec);
    expect(cycle.durationSec).toBeGreaterThan(drive.durationSec);
    expect(a.steps.at(-1)!.kind).toBe("arrive");
    expect(a.geometry[0]).toEqual(hotel);
  });
  it("transit has station legs and a fare", async () => {
    const t = await mockRouting.route(hotel, fuglen, "transit", { currency: "JPY" });
    expect(t.steps.map((s) => s.kind)).toEqual(["walk", "transit", "walk", "arrive"]);
    expect(t.fare).toEqual({ amount: expect.any(Number), currency: "JPY" });
  });
  it("compareModes returns all four", async () => {
    const c = await compareModes(hotel, fuglen, mockRouting, "JPY");
    expect(Object.keys(c).sort()).toEqual(["cycle", "drive", "transit", "walk"]);
  });
});

describe("OSRM adapter", () => {
  it("maps the response and uses the foot profile for walking", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toContain("/route/v1/foot/139.7006,35.6951;139.6893,35.669");
      return new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 3100, duration: 2400, geometry: { coordinates: [[139.7006, 35.6951], [139.6893, 35.669]] }, legs: [{ steps: [{ name: "Kōshū-kaidō", distance: 120, duration: 90, maneuver: { type: "turn", modifier: "left" } }, { name: "", distance: 0, duration: 0, maneuver: { type: "arrive" } }] }] }] }));
    }) as unknown as typeof fetch;
    const r = await createOsrmRouting({ fetchImpl }).route({ lat: 35.6951, lng: 139.7006 }, { lat: 35.669, lng: 139.6893 }, "walk");
    expect(r.source).toBe("osrm");
    expect(r.steps[0]).toMatchObject({ instruction: "Turn left onto Kōshū-kaidō", kind: "turn" });
    expect(r.geometry[1]).toEqual({ lat: 35.669, lng: 139.6893 });
  });
  it("transit falls back to the mock", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const r = await createOsrmRouting({ fetchImpl }).route({ lat: 35.6951, lng: 139.7006 }, { lat: 35.669, lng: 139.6893 }, "transit");
    expect(r.source).toBe("mock");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("formats durations and distances like the mockups", () => {
    expect(formatDuration(18 * 60)).toBe("18 min");
    expect(formatDuration(85 * 60)).toBe("1 h 25");
    expect(formatDuration(260 * 60, true)).toBe("4 h 20 min");
    expect(formatDistance(450)).toBe("450 m");
    expect(formatDistance(3100)).toBe("3.1 km");
  });
  it("adds to a clock", () => {
    expect(addToClock("08:40", 18 * 60)).toBe("08:58");
    expect(addToClock("23:50", 20 * 60)).toBe("00:10");
  });
  it("moves items", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
  });
});
