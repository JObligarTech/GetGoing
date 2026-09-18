/**
 * OpenStreetMap Nominatim geocoder — keyless, but rate-limited (1 req/s) and
 * requires a descriptive User-Agent per the usage policy. Call it server-side only.
 */
import type { GeocodeProvider, PlaceSearchResult } from "./types";

interface NominatimHit {
  place_id: number; lat: string; lon: string; display_name: string; name?: string; type?: string; class?: string;
  namedetails?: Record<string, string>;
}

export function createNominatimGeocode(opts: { userAgent: string; endpoint?: string; fetchImpl?: typeof fetch }): GeocodeProvider {
  const endpoint = opts.endpoint ?? "https://nominatim.openstreetmap.org/search";
  const f = opts.fetchImpl ?? fetch;
  return {
    async search(query, o) {
      const url = new URL(endpoint);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("namedetails", "1");
      url.searchParams.set("limit", String(o?.limit ?? 8));
      if (o?.countryCodes?.length) url.searchParams.set("countrycodes", o.countryCodes.join(",").toLowerCase());
      const res = await f(url, { headers: { "User-Agent": opts.userAgent, Accept: "application/json" }, signal: o?.signal });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const hits = (await res.json()) as NominatimHit[];
      return hits.map<PlaceSearchResult>((h) => ({
        provider: "osm",
        providerRef: String(h.place_id),
        name: h.name || h.display_name.split(",")[0]!.trim(),
        localName: h.namedetails?.["name:ja"] ?? h.namedetails?.name ?? null,
        address: h.display_name,
        location: { lat: Number(h.lat), lng: Number(h.lon) },
        kind: h.type,
      }));
    },
  };
}
