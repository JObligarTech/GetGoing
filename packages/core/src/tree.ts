/**
 * Navigation trees — routes that branch into groups and meet again.
 *
 * A tree is a trunk (stops everyone does, in order) with split sections: after a
 * trunk stop, one or more branches carry their own stops and travelers until the
 * next trunk stop, where everyone meets. Editing ops are pure and return a new
 * tree; `planTree` routes every lane and compares the branches.
 */
import type { ItineraryItem, Place, Traveler, TripBundle } from "./domain";
import { categoriesForPlace, itemsForDay, placeById, placeColor, stayForDate } from "./selectors";
import { addToClock, formatDistance, formatDuration, MODE_LABEL } from "./navigate";
import { TRAVEL_MODES, type RouteResult, type RoutingProvider, type TravelMode } from "./providers/routing";
import { categoryColors } from "@voya/tokens";

export interface TreeStop {
  id: string;
  placeId: string;
  /** null = trunk (everyone); otherwise the branch this stop belongs to */
  branchId: string | null;
  sortOrder: number;
  plannedTime: string | null;
  dwellMin: number | null;
  /** Mode used to reach this stop; null = the tree's default */
  mode: TravelMode | null;
}
export interface TreeBranch {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  /** The trunk stop this branch leaves from. */
  splitAfterStopId: string;
  /** Mode from the branch's last stop to the merge stop; null = default */
  mergeMode: TravelMode | null;
  travelerIds: string[];
}
export interface RouteTree {
  routeId: string | null;
  name: string;
  day: string | null;
  mode: TravelMode;
  stops: TreeStop[];
  branches: TreeBranch[];
}

export interface Lane { branch: TreeBranch; stops: TreeStop[] }
export type TreeSection =
  | { kind: "stop"; stop: TreeStop }
  | { kind: "split"; from: TreeStop; to: TreeStop | null; lanes: Lane[] };

export const BRANCH_COLORS = ["#2F5D3A", "#F2B233", "#5568C9", "#C9516F", "#E0703A"];
const BRANCH_NAMES = ["Group A", "Group B", "Group C", "Group D", "Group E"];

const byOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
export const trunkStops = (tree: RouteTree) => tree.stops.filter((s) => s.branchId === null).sort(byOrder);
export const laneStops = (tree: RouteTree, branchId: string) => tree.stops.filter((s) => s.branchId === branchId).sort(byOrder);
export const branchesAfter = (tree: RouteTree, stopId: string) => tree.branches.filter((b) => b.splitAfterStopId === stopId).sort(byOrder);

/** The tree as a vertical list: trunk stops, with a split section after any stop that has branches. */
export function treeSections(tree: RouteTree): TreeSection[] {
  const trunk = trunkStops(tree);
  const out: TreeSection[] = [];
  trunk.forEach((stop, i) => {
    out.push({ kind: "stop", stop });
    const branches = branchesAfter(tree, stop.id);
    if (branches.length) out.push({ kind: "split", from: stop, to: trunk[i + 1] ?? null, lanes: branches.map((branch) => ({ branch, stops: laneStops(tree, branch.id) })) });
  });
  return out;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Renumber every lane (and the trunk) 0..n so orders stay dense after edits. */
function normalize(tree: RouteTree): RouteTree {
  const lanes = new Map<string | null, TreeStop[]>();
  for (const s of tree.stops) lanes.set(s.branchId, [...(lanes.get(s.branchId) ?? []), s]);
  const stops: TreeStop[] = [];
  for (const arr of lanes.values()) arr.sort(byOrder).forEach((s, i) => stops.push({ ...s, sortOrder: i }));
  const branches = [...tree.branches].sort(byOrder).map((b, i) => ({ ...b, sortOrder: i }));
  return { ...tree, stops, branches };
}

// ─── Building ────────────────────────────────────────────────────────────────

/** Trunk-only tree from a day's plan: hotel → the day's places → hotel. */
export function treeFromDay(bundle: TripBundle, day: string, name?: string): RouteTree {
  const stay = stayForDate(bundle.stays, day);
  const hotel = stay ? placeById(bundle, stay.place_id) : null;
  const items = itemsForDay(bundle, day).filter((i) => i.place_id);
  const mids = items
    .map((item) => ({ item, place: placeById(bundle, item.place_id) }))
    .filter((x): x is { item: ItineraryItem; place: Place } => !!x.place && x.place.lat != null)
    .map(({ item, place }): TreeStop => ({ id: newId(), placeId: place.id, branchId: null, sortOrder: 0, plannedTime: item.start_time?.slice(0, 5) ?? null, dwellMin: 60, mode: null }));
  const stops = hotel && hotel.lat != null
    ? [{ id: newId(), placeId: hotel.id, branchId: null, sortOrder: 0, plannedTime: null, dwellMin: null, mode: null }, ...mids, { id: newId(), placeId: hotel.id, branchId: null, sortOrder: 0, plannedTime: null, dwellMin: null, mode: null }]
    : mids;
  return normalize({ routeId: null, name: name ?? "New tree route", day, mode: "transit", stops, branches: [] });
}

/** Rebuild the editable tree from a saved route's rows. */
export function treeFromSaved(bundle: TripBundle, routeId: string): RouteTree | null {
  const route = bundle.routes.find((r) => r.id === routeId);
  if (!route) return null;
  const stops: TreeStop[] = bundle.routeStops.filter((s) => s.route_id === routeId).map((s) => ({
    id: s.id, placeId: s.place_id, branchId: s.branch_id, sortOrder: s.sort_order, plannedTime: s.planned_time?.slice(0, 5) ?? null, dwellMin: s.dwell_min, mode: s.mode,
  }));
  const branches: TreeBranch[] = bundle.routeBranches.filter((b) => b.route_id === routeId).map((b) => ({
    id: b.id, name: b.name, color: b.color, sortOrder: b.sort_order, splitAfterStopId: b.split_after_stop_id, mergeMode: b.merge_mode,
    travelerIds: bundle.routeBranchTravelers.filter((t) => t.branch_id === b.id).map((t) => t.traveler_id),
  }));
  return normalize({ routeId, name: route.name, day: route.day, mode: route.mode, stops, branches });
}

export const isTree = (bundle: Pick<TripBundle, "routeBranches">, routeId: string) => bundle.routeBranches.some((b) => b.route_id === routeId);

// ─── Editing ─────────────────────────────────────────────────────────────────

/** Insert a stop after `afterStopId` in that stop's lane, or at the end of `branchId` when after is null. */
export function addStop(tree: RouteTree, placeId: string, at: { afterStopId: string } | { branchId: string | null }): RouteTree {
  const after = "afterStopId" in at ? tree.stops.find((s) => s.id === at.afterStopId) : null;
  const branchId = after ? after.branchId : "branchId" in at ? at.branchId : null;
  const lane = tree.stops.filter((s) => s.branchId === branchId).sort(byOrder);
  const order = after ? after.sortOrder + 0.5 : lane.length;
  const stop: TreeStop = { id: newId(), placeId, branchId, sortOrder: order, plannedTime: null, dwellMin: 60, mode: null };
  return normalize({ ...tree, stops: [...tree.stops, stop] });
}

/** Remove a stop. Removing a trunk stop that branches split from re-attaches those branches to the previous trunk stop (or drops them if there is none). */
export function removeStop(tree: RouteTree, stopId: string): RouteTree {
  const stop = tree.stops.find((s) => s.id === stopId);
  if (!stop) return tree;
  let branches = tree.branches;
  let stops = tree.stops.filter((s) => s.id !== stopId);
  if (stop.branchId === null) {
    const trunk = trunkStops(tree);
    const prev = trunk[trunk.findIndex((s) => s.id === stopId) - 1];
    const moving = tree.branches.filter((b) => b.splitAfterStopId === stopId);
    if (prev) {
      // Branches already after `prev` keep their order; moved ones follow.
      const base = branchesAfter(tree, prev.id).length;
      branches = tree.branches.map((b) => moving.includes(b) ? { ...b, splitAfterStopId: prev.id, sortOrder: base + b.sortOrder } : b);
    } else {
      branches = tree.branches.filter((b) => !moving.includes(b));
      stops = stops.filter((s) => !moving.some((b) => b.id === s.branchId));
    }
  }
  return normalize({ ...tree, stops, branches });
}

/** Swap a stop with its neighbour in the same lane. */
export function moveStop(tree: RouteTree, stopId: string, delta: -1 | 1): RouteTree {
  const stop = tree.stops.find((s) => s.id === stopId);
  if (!stop) return tree;
  const lane = tree.stops.filter((s) => s.branchId === stop.branchId).sort(byOrder);
  const i = lane.findIndex((s) => s.id === stopId), j = i + delta;
  if (j < 0 || j >= lane.length) return tree;
  const other = lane[j]!;
  return normalize({ ...tree, stops: tree.stops.map((s) => s.id === stop.id ? { ...s, sortOrder: other.sortOrder } : s.id === other.id ? { ...s, sortOrder: stop.sortOrder } : s) });
}

/** Split after a trunk stop into `count` branches; travelers are dealt out in halves (adjust in the segment sheet). */
export function branchAt(tree: RouteTree, afterStopId: string, travelers: Pick<Traveler, "id">[], count = 2): RouteTree {
  const stop = tree.stops.find((s) => s.id === afterStopId);
  if (!stop || stop.branchId !== null) return tree;
  const existing = branchesAfter(tree, afterStopId);
  const per = Math.ceil(travelers.length / count);
  const branches: TreeBranch[] = Array.from({ length: count }, (_, i) => {
    const n = existing.length + i;
    return {
      id: newId(), name: BRANCH_NAMES[n] ?? `Group ${n + 1}`, color: BRANCH_COLORS[n % BRANCH_COLORS.length]!, sortOrder: n, splitAfterStopId: afterStopId, mergeMode: null,
      travelerIds: existing.length ? [] : travelers.slice(i * per, (i + 1) * per).map((t) => t.id),
    };
  });
  return normalize({ ...tree, branches: [...tree.branches, ...branches] });
}

/** Add one more branch to an existing split. */
export function addBranch(tree: RouteTree, afterStopId: string): RouteTree {
  return branchAt(tree, afterStopId, [], 1);
}

export function removeBranch(tree: RouteTree, branchId: string): RouteTree {
  return normalize({ ...tree, branches: tree.branches.filter((b) => b.id !== branchId), stops: tree.stops.filter((s) => s.branchId !== branchId) });
}

/** Merge: everyone meets at a new trunk stop right after the split section that follows `splitAfterStopId`. */
export function mergeAt(tree: RouteTree, splitAfterStopId: string, placeId: string): RouteTree {
  return addStop(tree, placeId, { afterStopId: splitAfterStopId });
}

/** Put a traveler on a branch (and off its siblings in the same split). */
export function assignTraveler(tree: RouteTree, branchId: string, travelerId: string, on = true): RouteTree {
  const branch = tree.branches.find((b) => b.id === branchId);
  if (!branch) return tree;
  return {
    ...tree,
    branches: tree.branches.map((b) => {
      if (b.id === branchId) return { ...b, travelerIds: on ? [...new Set([...b.travelerIds, travelerId])] : b.travelerIds.filter((t) => t !== travelerId) };
      if (on && b.splitAfterStopId === branch.splitAfterStopId) return { ...b, travelerIds: b.travelerIds.filter((t) => t !== travelerId) };
      return b;
    }),
  };
}

export function updateStop(tree: RouteTree, stopId: string, patch: Partial<Pick<TreeStop, "mode" | "plannedTime" | "dwellMin">>): RouteTree {
  return { ...tree, stops: tree.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)) };
}
export function updateBranch(tree: RouteTree, branchId: string, patch: Partial<Pick<TreeBranch, "name" | "mergeMode" | "color">>): RouteTree {
  return { ...tree, branches: tree.branches.map((b) => (b.id === branchId ? { ...b, ...patch } : b)) };
}

// ─── Planning ────────────────────────────────────────────────────────────────

export interface TreeLeg { from: TreeStop; to: TreeStop; branchId: string | null; mode: TravelMode; route: RouteResult }
export interface LaneSummary {
  branch: TreeBranch;
  travelSec: number;
  walkM: number;
  fares: { amount: number; currency: string } | null;
  transfers: number;
  /** When this lane reaches the merge stop (or ends), HH:MM */
  arrive: string | null;
  /** Leave the split stop → arrive at the merge, in seconds */
  doorToDoorSec: number;
  /** "Train 18 → Shibuya Sky 90 → Walk 6" */
  chain: string;
  alternatives: { legIndex: number; mode: TravelMode; label: string; deltaSec: number; fare: { amount: number; currency: string } | null }[];
}
export interface TreePlan {
  /** arrive/leave per stop id */
  times: Record<string, { arrive: string | null; leave: string }>;
  legs: TreeLeg[];
  lanes: LaneSummary[];
  /** Everyone reaches the last trunk stop by */
  endsAt: string | null;
  insight: string | null;
  unassignedTravelerIds: string[];
  estimated: boolean;
}

const legMode = (tree: RouteTree, to: TreeStop) => to.mode ?? tree.mode;
const laneWalkM = (r: RouteResult) => r.steps.filter((s) => s.kind === "walk" || s.kind === "turn").reduce((x, s) => x + s.distanceM, 0);
const short = (name: string) => name.split(" ").slice(0, 2).join(" ");
const legWord = (mode: TravelMode) => (mode === "transit" ? "Train" : MODE_LABEL[mode]);

/**
 * Route every lane and compare the branches. Timing: leave the first stop at its
 * planned time (or in time for the first planned stop), arrive = leave + leg,
 * leave = max(planned, arrive + dwell); at a merge everyone waits for the last lane.
 */
export async function planTree(tree: RouteTree, bundle: TripBundle, provider: RoutingProvider, currency: string): Promise<TreePlan> {
  const place = (s: TreeStop) => placeById(bundle, s.placeId)!;
  const ll = (s: TreeStop) => ({ lat: place(s).lat!, lng: place(s).lng! });
  const cache = new Map<string, Promise<RouteResult>>();
  const route = (a: TreeStop, b: TreeStop, mode: TravelMode) => {
    const k = `${a.placeId}|${b.placeId}|${mode}`;
    if (!cache.has(k)) cache.set(k, provider.route(ll(a), ll(b), mode, { currency }));
    return cache.get(k)!;
  };
  const sections = treeSections(tree);
  const trunk = trunkStops(tree);
  const times: TreePlan["times"] = {};
  const legs: TreeLeg[] = [];
  const lanes: LaneSummary[] = [];
  if (trunk.length === 0) return { times, legs, lanes, endsAt: null, insight: null, unassignedTravelerIds: [], estimated: false };

  // Departure from the first stop: its planned time, else back-computed from the first planned successor.
  const first = trunk[0]!;
  let leave = first.plannedTime;
  if (!leave) {
    const successors: TreeStop[] = [];
    const split = sections[1];
    if (split?.kind === "split") split.lanes.forEach((l) => successors.push(l.stops[0] ?? (split.to as TreeStop)));
    else if (trunk[1]) successors.push(trunk[1]);
    const cands = await Promise.all(successors.filter((s) => s && s.plannedTime).map(async (s) => addToClock(s.plannedTime!, -(await route(first, s, legMode(tree, s))).durationSec)));
    leave = cands.sort()[0] ?? "09:00";
  }
  times[first.id] = { arrive: null, leave };
  const dwellSec = (s: TreeStop) => (s.dwellMin ?? 0) * 60;
  const settle = (s: TreeStop, arrive: string) => (s.plannedTime && s.plannedTime > arrive ? s.plannedTime : addToClock(arrive, dwellSec(s)));

  let clock = leave;
  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i]!;
    if (sec.kind === "stop") {
      const prev = trunk[trunk.findIndex((s) => s.id === sec.stop.id) - 1]!;
      const prevSection = sections[i - 1];
      if (prevSection?.kind === "split") continue; // handled by the split below
      const mode = legMode(tree, sec.stop);
      const r = await route(prev, sec.stop, mode);
      legs.push({ from: prev, to: sec.stop, branchId: null, mode, route: r });
      const arrive = addToClock(clock, r.durationSec);
      clock = settle(sec.stop, arrive);
      times[sec.stop.id] = { arrive, leave: clock };
      continue;
    }
    // Split: run each lane from `from` to `to`.
    const laneArrivals: string[] = [];
    for (const lane of sec.lanes) {
      let t = times[sec.from.id]!.leave;
      let prev = sec.from;
      let travelSec = 0, walkM = 0, transfers = 0, fare = 0;
      const chain: string[] = [];
      const laneLegs: TreeLeg[] = [];
      const path = [...lane.stops, ...(sec.to ? [sec.to] : [])];
      for (const [j, s] of path.entries()) {
        const isMerge = sec.to && s.id === sec.to.id;
        const mode = isMerge ? lane.branch.mergeMode ?? tree.mode : legMode(tree, s);
        const r = await route(prev, s, mode);
        const leg = { from: prev, to: s, branchId: lane.branch.id, mode, route: r };
        legs.push(leg); laneLegs.push(leg);
        travelSec += r.durationSec; walkM += laneWalkM(r); transfers += r.transfers ?? 0; fare += r.fare?.amount ?? 0;
        chain.push(`${legWord(mode)} ${Math.round(r.durationSec / 60)}`);
        const arrive = addToClock(t, r.durationSec);
        if (isMerge) { t = arrive; laneArrivals.push(arrive); }
        else { t = settle(s, arrive); times[s.id] = { arrive, leave: t }; chain.push(`${short(place(s).name)} ${Math.round((dwellSec(s) || 0) / 60)}`); }
        void j;
        prev = s;
      }
      // Alternatives: the longest leg re-routed by the other modes.
      const longest = laneLegs.reduce((a, l, idx) => (l.route.durationSec > (laneLegs[a]?.route.durationSec ?? -1) ? idx : a), 0);
      const alternatives: LaneSummary["alternatives"] = [];
      if (laneLegs[longest]) {
        const L = laneLegs[longest]!;
        for (const m of TRAVEL_MODES.filter((m) => m !== L.mode && (m === "walk" || m === "drive"))) {
          const alt = await route(L.from, L.to, m).catch(() => null);
          if (!alt) continue;
          const label = m === "walk" ? `Walk instead of ${legWord(L.mode).toLowerCase()}` : `Taxi to ${short(place(L.to).name)}`;
          alternatives.push({ legIndex: longest, mode: m, label, deltaSec: alt.durationSec - L.route.durationSec, fare: alt.fare ?? null });
        }
      }
      const startLeave = times[sec.from.id]!.leave;
      const end = sec.to ? t : times[lane.stops.at(-1)?.id ?? ""]?.leave ?? null;
      lanes.push({
        branch: lane.branch, travelSec, walkM, transfers, fares: fare ? { amount: fare, currency } : null,
        arrive: sec.to ? t : end, doorToDoorSec: end ? clockDiff(startLeave, end) : travelSec, chain: chain.join(" → "), alternatives,
      });
    }
    if (sec.to) {
      const arrive = laneArrivals.sort().at(-1) ?? times[sec.from.id]!.leave;
      clock = settle(sec.to, arrive);
      times[sec.to.id] = { arrive, leave: clock };
    }
  }

  const last = trunk.at(-1)!;
  const assigned = new Set(tree.branches.flatMap((b) => b.travelerIds));
  const unassigned = tree.branches.length ? bundle.travelers.filter((t) => !assigned.has(t.id)).map((t) => t.id) : [];
  return {
    times, legs, lanes, endsAt: times[last.id]?.arrive ?? null,
    insight: laneInsight(lanes, tree, sections),
    unassignedTravelerIds: unassigned,
    estimated: legs.some((l) => l.route.source === "mock"),
  };
}

export function clockDiff(a: string, b: string): number {
  const m = (s: string) => { const [h, mm] = s.split(":").map(Number) as [number, number]; return h * 60 + mm; };
  return ((m(b) - m(a) + 1440) % 1440) * 60;
}

/** "Group B arrives 12 min earlier. Both make the 7:30 reservation." */
function laneInsight(lanes: LaneSummary[], tree: RouteTree, sections: TreeSection[]): string | null {
  if (lanes.length < 2) return null;
  const [a, b] = [...lanes].sort((x, y) => (x.arrive ?? "").localeCompare(y.arrive ?? ""));
  if (!a?.arrive || !b?.arrive) return null;
  const diff = Math.round(clockDiff(a.arrive, b.arrive) / 60);
  const parts: string[] = [];
  parts.push(diff === 0 ? `${a.branch.name} and ${b.branch.name} arrive together.` : `${a.branch.name} arrives ${formatDuration(diff * 60)} earlier.`);
  const split = sections.find((s): s is Extract<TreeSection, { kind: "split" }> => s.kind === "split" && s.lanes.some((l) => l.branch.id === a.branch.id));
  const meet = split?.to;
  if (meet?.plannedTime) {
    const late = lanes.filter((l) => l.arrive && l.arrive > meet.plannedTime!);
    parts.push(late.length === 0 ? `${lanes.length === 2 ? "Both" : "All"} make the ${fmtClock(meet.plannedTime)} plan.` : `${late.map((l) => l.branch.name).join(" and ")} would miss the ${fmtClock(meet.plannedTime)} plan.`);
  }
  for (const l of lanes) {
    const walk = l.alternatives.find((x) => x.mode === "walk");
    if (l.fares && walk && walk.deltaSec > 0 && walk.deltaSec < 40 * 60) parts.push(`${l.branch.name}'s fare could be avoided by walking (+${formatDuration(walk.deltaSec)}).`);
  }
  return parts.join(" ");
}

const fmtClock = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number) as [number, number]; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? " AM" : " PM"}`; };

/** Pins + per-lane polylines for the map; the trunk is drawn in the primary colour. */
export function treeMapData(tree: RouteTree, bundle: TripBundle, plan: TreePlan | null) {
  const pins = tree.stops.map((s) => {
    const p = placeById(bundle, s.placeId);
    const branch = tree.branches.find((b) => b.id === s.branchId);
    const isHotel = !!p && bundle.stays.some((st) => st.place_id === p.id);
    return p && p.lat != null ? { id: s.id, lat: p.lat, lng: p.lng!, label: isHotel ? "Hotel" : p.name, color: branch?.color ?? (isHotel ? categoryColors.stay : placeColor(bundle, p)), dark: isHotel } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const paths = (plan?.legs ?? []).map((l) => ({ points: l.route.geometry, color: tree.branches.find((b) => b.id === l.branchId)?.color ?? "#2F5D3A" }));
  return { pins, paths };
}

/** Category name for the stop subtitle ("Coffee", "Must visit"). */
export function stopCategory(bundle: TripBundle, placeId: string): string {
  return categoriesForPlace(bundle, placeId)[0]?.name ?? "Saved";
}

export const describeLane = (lane: LaneSummary, currency: string) =>
  `${formatDuration(lane.travelSec)} travel · ${formatDistance(lane.walkM)} walking${lane.fares ? ` · fares ${lane.fares.amount} ${currency} pp` : ""}${lane.transfers ? ` · ${lane.transfers} transfer${lane.transfers > 1 ? "s" : ""}` : ""}`;
