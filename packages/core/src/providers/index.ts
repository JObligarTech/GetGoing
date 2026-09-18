export * from "./types";
export * from "./mock";
export { createNominatimGeocode } from "./nominatim";
export { createFrankfurterFx } from "./frankfurter";
export * from "./routing";

import { mockProviders } from "./mock";
import { createFrankfurterFx } from "./frankfurter";
import { createNominatimGeocode } from "./nominatim";
import type { Providers } from "./types";
import { createOsrmRouting, mockRouting, type RoutingProvider } from "./routing";

/** Resolve providers from env names; anything unset falls back to the mock. Server-side only. */
export function resolveProviders(env: { GEOCODE_PROVIDER?: string; FX_PROVIDER?: string; TRANSLATION_PROVIDER?: string; ROUTING_PROVIDER?: string; OSRM_URL?: string; SITE_URL?: string }): Providers & { routing: RoutingProvider } {
  return {
    routing: env.ROUTING_PROVIDER === "osrm" ? createOsrmRouting({ endpoint: env.OSRM_URL }) : mockRouting,
    geocode: env.GEOCODE_PROVIDER === "nominatim" ? createNominatimGeocode({ userAgent: `Voya/0.1 (${env.SITE_URL ?? "dev"})` }) : mockProviders.geocode,
    fx: env.FX_PROVIDER === "frankfurter" ? createFrankfurterFx() : mockProviders.fx,
    translation: mockProviders.translation,
    ocr: mockProviders.ocr,
  };
}
