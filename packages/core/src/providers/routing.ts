/**
 * Routing provider — directions between two points for one travel mode.
 * The mock adapter is deterministic (haversine + per-mode speed) so screens and
 * tests work with no network; OSRM is the keyless live adapter.
 */
import type { LatLng } from "../domain";
import { distanceKm } from "../selectors";

export type TravelMode = "walk" | "transit" | "drive" | "cycle";
export const TRAVEL_MODES: TravelMode[] = ["walk", "transit", "drive", "cycle"];

export interface RouteStep {
  /** Plain-language instruction: "Turn left onto Kōshū-kaidō", "Yamanote line → Shibuya". */
  instruction: string;
  detail?: string;
  distanceM: number;
  durationSec: number;
  /** Step kind for the icon: walking, transit vehicle, turn, arrive. */
  kind: "walk" | "transit" | "turn" | "arrive";
}

export interface RouteResult {
  mode: TravelMode;
  durationSec: number;
  distanceM: number;
  steps: RouteStep[];
  /** Polyline for the map. */
  geometry: LatLng[];
  fare?: { amount: number; currency: string };
  transfers?: number;
  /** Where the result came from, for the "estimated" caveat in the UI. */
  source: "mock" | "osrm";
}

export interface RoutingProvider {
  route(from: LatLng, to: LatLng, mode: TravelMode, opts?: { currency?: string; signal?: AbortSignal }): Promise<RouteResult>;
}

// ─── Mock ────────────────────────────────────────────────────────────────────

/** Metres per second by mode; transit uses an effective door-to-door speed. */
const SPEED: Record<TravelMode, number> = { walk: 1.33, cycle: 4.2, drive: 7.5, transit: 5.5 };
/** Route length vs straight line — streets aren't straight. */
const DETOUR: Record<TravelMode, number> = { walk: 1.25, cycle: 1.3, drive: 1.4, transit: 1.35 };

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** A slightly bent line so the drawn route doesn't look like a ruler. */
function bentLine(a: LatLng, b: LatLng): LatLng[] {
  const m = lerp(a, b, 0.5);
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  const k = 0.12;
  return [a, lerp(a, b, 0.25), { lat: m.lat + dx * k, lng: m.lng - dy * k }, lerp(a, b, 0.75), b];
}

/** Base transit fare per km, by currency, rounded to local coin sizes. Rough but plausible. */
const FARE: Record<string, { base: number; perKm: number; round: number }> = {
  JPY: { base: 150, perKm: 12, round: 10 },
  USD: { base: 2.5, perKm: 0.25, round: 0.25 },
  EUR: { base: 1.8, perKm: 0.2, round: 0.1 },
  GBP: { base: 1.9, perKm: 0.3, round: 0.1 },
};

export const mockRouting: RoutingProvider = {
  async route(from, to, mode, opts) {
    const straightM = distanceKm(from, to) * 1000;
    const distanceM = Math.round(straightM * DETOUR[mode]);
    const overhead = mode === "transit" ? 6 * 60 : mode === "drive" ? 3 * 60 : 0; // waiting / parking
    const durationSec = Math.round(distanceM / SPEED[mode] + overhead);
    const geometry = bentLine(from, to);
    const steps: RouteStep[] = [];

    if (mode === "transit" && distanceM > 1200) {
      const walkA = Math.round(Math.min(450, distanceM * 0.15));
      const walkB = Math.round(Math.min(380, distanceM * 0.12));
      const ride = distanceM - walkA - walkB;
      const rideSec = Math.round(ride / 9);
      const stops = Math.max(1, Math.round(ride / 1100));
      steps.push(
        { kind: "walk", instruction: "Walk to the station", detail: `${walkA} m`, distanceM: walkA, durationSec: Math.round(walkA / SPEED.walk) },
        { kind: "transit", instruction: `Train · ${stops} ${stops === 1 ? "stop" : "stops"}`, detail: "Check the platform on arrival", distanceM: ride, durationSec: rideSec },
        { kind: "walk", instruction: "Walk to your destination", detail: `${walkB} m`, distanceM: walkB, durationSec: Math.round(walkB / SPEED.walk) },
        { kind: "arrive", instruction: "Arrive", distanceM: 0, durationSec: 0 },
      );
    } else {
      const parts = Math.max(2, Math.min(5, Math.round(distanceM / 400)));
      const each = Math.round(distanceM / parts);
      const verbs = ["Head out", "Continue straight", "Turn left", "Turn right", "Keep going"];
      for (let i = 0; i < parts; i++) {
        steps.push({ kind: i === 0 ? "walk" : "turn", instruction: verbs[i % verbs.length]!, detail: `${each} m`, distanceM: each, durationSec: Math.round(each / SPEED[mode]) });
      }
      steps.push({ kind: "arrive", instruction: "Arrive", distanceM: 0, durationSec: 0 });
    }

    const result: RouteResult = { mode, durationSec, distanceM, steps, geometry, source: "mock" };
    if (mode === "transit") {
      const cur = opts?.currency ?? "USD";
      const f = FARE[cur] ?? FARE.USD!;
      const raw = f.base + (distanceM / 1000) * f.perKm;
      result.fare = { amount: Math.round(raw / f.round) * f.round, currency: cur };
      result.transfers = distanceM > 6000 ? 1 : 0;
    }
    return result;
  },
};

// ─── OSRM (walk / cycle / drive; transit falls back to the mock) ────────────

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: { name: string; distance: number; duration: number; maneuver: { type: string; modifier?: string } }[] }[] }[];
}

const OSRM_PROFILE: Record<Exclude<TravelMode, "transit">, string> = { walk: "foot", cycle: "bike", drive: "car" };

export function createOsrmRouting(opts: { endpoint?: string; fetchImpl?: typeof fetch; transitFallback?: RoutingProvider } = {}): RoutingProvider {
  const endpoint = (opts.endpoint ?? "https://router.project-osrm.org").replace(/\/$/, "");
  const f = opts.fetchImpl ?? fetch;
  const fallback = opts.transitFallback ?? mockRouting;
  return {
    async route(from, to, mode, o) {
      if (mode === "transit") return fallback.route(from, to, mode, o); // OSRM has no timetables
      const url = `${endpoint}/route/v1/${OSRM_PROFILE[mode]}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson&steps=true`;
      const res = await f(url, { signal: o?.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const body = (await res.json()) as OsrmResponse;
      const r = body.routes?.[0];
      if (body.code !== "Ok" || !r) throw new Error(`OSRM ${body.code}`);
      const steps: RouteStep[] = r.legs.flatMap((leg) =>
        leg.steps.map((s) => {
          const t = s.maneuver.type, m = s.maneuver.modifier;
          const kind: RouteStep["kind"] = t === "arrive" ? "arrive" : t === "depart" ? "walk" : "turn";
          const verb = t === "arrive" ? "Arrive" : t === "depart" ? "Head out" : m ? `Turn ${m}` : "Continue";
          return { kind, instruction: s.name ? `${verb} onto ${s.name}` : verb, distanceM: Math.round(s.distance), durationSec: Math.round(s.duration) };
        }),
      );
      return {
        mode, durationSec: Math.round(r.duration), distanceM: Math.round(r.distance), steps,
        geometry: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), source: "osrm",
      };
    },
  };
}
