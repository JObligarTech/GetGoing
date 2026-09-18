import { describe, expect, it } from "vitest";
import { demoBundle } from "./demo";
import { mockRouting } from "./providers/routing";
import {
  addStop, assignTraveler, branchAt, isTree, mergeAt, moveStop, planTree, removeBranch, removeStop, treeFromDay, treeFromSaved, treeMapData, treeSections, trunkStops, updateBranch, updateStop,
} from "./tree";
import { treeSchema } from "./schemas";

const P = (n: number) => `44444444-4444-4444-8444-44444444444${n}`;
const TREE = "55555555-5555-4555-8555-555555555553";

describe("tree layout", () => {
  it("rebuilds the demo tree: hotel → (A | B) → dinner", () => {
    const tree = treeFromSaved(demoBundle, TREE)!;
    expect(isTree(demoBundle, TREE)).toBe(true);
    const sections = treeSections(tree);
    expect(sections.map((s) => s.kind)).toEqual(["stop", "split", "stop"]);
    const split = sections[1];
    if (split?.kind !== "split") throw new Error("expected a split");
    expect(split.from.placeId).toBe(P(1));
    expect(split.to?.placeId).toBe(P(5));
    expect(split.lanes.map((l) => l.branch.name)).toEqual(["Group A", "Group B"]);
    expect(split.lanes[0]!.stops.map((s) => s.placeId)).toEqual([P(4)]);
    expect(split.lanes[0]!.branch.travelerIds).toEqual(["t1", "t4"]);
  });

  it("a day tree is trunk-only and bookended by the hotel", () => {
    const tree = treeFromDay(demoBundle, "2027-03-15", "Day 1");
    expect(treeSections(tree).every((s) => s.kind === "stop")).toBe(true);
    const trunk = trunkStops(tree);
    expect(trunk[0]!.placeId).toBe(P(1));
    expect(trunk.at(-1)!.placeId).toBe(P(1));
    expect(trunk[1]).toMatchObject({ placeId: P(2), plannedTime: "09:00", dwellMin: 60 });
  });
});

describe("tree editing", () => {
  const base = treeFromDay(demoBundle, "2027-03-15", "Day 1");
  const hotel = trunkStops(base)[0]!;

  it("branches after a trunk stop, dealing travelers into halves, and merges at a new trunk stop", () => {
    let t = branchAt(base, hotel.id, demoBundle.travelers);
    expect(t.branches).toHaveLength(2);
    expect(t.branches.map((b) => b.travelerIds)).toEqual([["t1", "t2"], ["t3", "t4"]]);
    const sections = treeSections(t);
    expect(sections[1]!.kind).toBe("split");
    // Merge point = the next trunk stop; adding one right after the split stop inserts before Fuglen.
    t = mergeAt(t, hotel.id, P(6));
    expect(trunkStops(t).map((s) => s.placeId).slice(0, 3)).toEqual([P(1), P(6), P(2)]);
    const split = treeSections(t)[1];
    if (split?.kind !== "split") throw new Error();
    expect(split.to?.placeId).toBe(P(6));
  });

  it("adds, moves and removes stops within a lane; orders stay dense", () => {
    let t = branchAt(base, hotel.id, demoBundle.travelers);
    const a = t.branches[0]!;
    t = addStop(t, P(4), { branchId: a.id });
    t = addStop(t, P(7), { branchId: a.id });
    let lane = t.stops.filter((s) => s.branchId === a.id).sort((x, y) => x.sortOrder - y.sortOrder);
    expect(lane.map((s) => [s.placeId, s.sortOrder])).toEqual([[P(4), 0], [P(7), 1]]);
    t = moveStop(t, lane[1]!.id, -1);
    lane = t.stops.filter((s) => s.branchId === a.id).sort((x, y) => x.sortOrder - y.sortOrder);
    expect(lane.map((s) => s.placeId)).toEqual([P(7), P(4)]);
    expect(moveStop(t, lane[0]!.id, -1)).toBe(t); // no-op at the edge
    t = removeStop(t, lane[0]!.id);
    expect(t.stops.filter((s) => s.branchId === a.id)).toHaveLength(1);
    // Trunk stops stay untouched by lane edits.
    expect(trunkStops(t).map((s) => s.placeId)).toEqual(trunkStops(base).map((s) => s.placeId));
  });

  it("removing the trunk stop a branch splits from re-attaches the branch to the previous stop", () => {
    const fuglen = trunkStops(base)[1]!;
    let t = branchAt(base, fuglen.id, demoBundle.travelers);
    t = removeStop(t, fuglen.id);
    expect(t.branches.every((b) => b.splitAfterStopId === hotel.id)).toBe(true);
    // …and removing the very first stop drops branches that have nowhere to hang.
    let u = branchAt(base, hotel.id, demoBundle.travelers);
    u = addStop(u, P(4), { branchId: u.branches[0]!.id });
    u = removeStop(u, hotel.id);
    expect(u.branches).toHaveLength(0);
    expect(u.stops.every((s) => s.branchId === null)).toBe(true);
  });

  it("a traveler is on at most one branch of a split", () => {
    let t = branchAt(base, hotel.id, demoBundle.travelers);
    const [a, b] = t.branches as [typeof t.branches[0], typeof t.branches[0]];
    t = assignTraveler(t, b.id, "t1");
    expect(t.branches.find((x) => x.id === a.id)!.travelerIds).toEqual(["t2"]);
    expect(t.branches.find((x) => x.id === b.id)!.travelerIds).toEqual(["t3", "t4", "t1"]);
    t = assignTraveler(t, b.id, "t1", false);
    expect(t.branches.find((x) => x.id === b.id)!.travelerIds).toEqual(["t3", "t4"]);
    t = removeBranch(t, b.id);
    expect(t.branches).toHaveLength(1);
  });
});

describe("planTree", () => {
  it("times both lanes, waits for the slower one at the merge, and compares them", async () => {
    let tree = treeFromSaved(demoBundle, TREE)!;
    const plan = await planTree(tree, demoBundle, mockRouting, "JPY");
    const [hotel, dinner] = trunkStops(tree);
    expect(plan.times[hotel!.id]).toEqual({ arrive: null, leave: "14:30" });
    expect(plan.lanes.map((l) => l.branch.name)).toEqual(["Group A", "Group B"]);
    for (const lane of plan.lanes) {
      expect(lane.travelSec).toBeGreaterThan(0);
      expect(lane.arrive).toMatch(/^\d{2}:\d{2}$/);
      expect(lane.chain).toMatch(/^(Train|Walk) \d+ → /);
    }
    // Dinner is planned for 19:30 and both lanes are done well before; everyone leaves at the plan.
    const arrivals = plan.lanes.map((l) => l.arrive!).sort();
    expect(plan.times[dinner!.id]!.arrive).toBe(arrivals.at(-1));
    expect(plan.times[dinner!.id]!.leave).toBe("19:30");
    expect(plan.insight).toMatch(/arrives .* earlier\.|arrive together\./);
    expect(plan.insight).toContain("Both make the 7:30 PM plan.");
    expect(plan.unassignedTravelerIds).toEqual([]);
    expect(plan.estimated).toBe(true);
    // Group A rides transit, so it gets fares and a walk alternative; Group B walks so it has none.
    const a = plan.lanes[0]!, b = plan.lanes[1]!;
    expect(a.fares?.currency).toBe("JPY");
    expect(b.fares).toBeNull();
    expect(a.alternatives.map((x) => x.mode)).toEqual(["walk", "drive"]);
    expect(a.alternatives[0]!.deltaSec).toBeGreaterThan(0);
    // Changing the merge mode changes the lane, and the map gets one coloured path per leg.
    tree = updateBranch(tree, a.branch.id, { mergeMode: "walk" });
    const plan2 = await planTree(tree, demoBundle, mockRouting, "JPY");
    expect(plan2.lanes[0]!.travelSec).toBeGreaterThan(a.travelSec);
    const map = treeMapData(tree, demoBundle, plan2);
    expect(map.pins).toHaveLength(4);
    expect(map.paths).toHaveLength(4);
    expect(new Set(map.paths.map((p) => p.color))).toEqual(new Set(["#2F5D3A", "#F2B233"]));
  });

  it("back-computes the departure so the first planned stop is met, and flags unassigned travelers", async () => {
    let tree = treeFromDay(demoBundle, "2027-03-15", "Day 1");
    const hotel = trunkStops(tree)[0]!;
    tree = branchAt(tree, hotel.id, demoBundle.travelers.slice(0, 2));
    tree = updateStop(tree, trunkStops(tree)[1]!.id, { plannedTime: "09:00" });
    const plan = await planTree(tree, demoBundle, mockRouting, "JPY");
    expect(plan.times[hotel.id]!.leave < "09:00").toBe(true);
    expect(plan.unassignedTravelerIds).toEqual(["t3", "t4"]);
    expect(plan.lanes).toHaveLength(2); // empty lanes route straight to the merge
  });
});

describe("treeSchema", () => {
  it("rejects branches that hang off a branch stop and stops that point at missing branches", () => {
    const tree = treeFromSaved(demoBundle, TREE)!;
    const ok = treeSchema.safeParse({ ...tree, tripId: demoBundle.trip.id });
    expect(ok.success).toBe(true);
    const laneStop = tree.stops.find((s) => s.branchId)!;
    const bad = treeSchema.safeParse({ ...tree, tripId: demoBundle.trip.id, branches: tree.branches.map((b) => ({ ...b, splitAfterStopId: laneStop.id })) });
    expect(bad.success).toBe(false);
    const orphan = treeSchema.safeParse({ ...tree, tripId: demoBundle.trip.id, stops: tree.stops.map((s) => (s.branchId ? { ...s, branchId: "nope" } : s)) });
    expect(orphan.success).toBe(false);
  });
});
