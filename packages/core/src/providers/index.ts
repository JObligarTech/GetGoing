export * from "./types";
export * from "./mock";
export { createNominatimGeocode } from "./nominatim";
export { createFrankfurterFx } from "./frankfurter";
export { createDeepLTranslation, deeplEndpoint, deeplSource, deeplTarget, type DeepLProvider } from "./deepl";
export { createGoogleVisionOcr, linesFromVision, type VisionResponse } from "./google-vision";
export { createRelayProviders, RelayError } from "./relay";
export { bytesToBase64, base64ToBytes } from "./base64";
export * from "./routing";
export * from "./billing";

import { mockProviders } from "./mock";
import { createFrankfurterFx } from "./frankfurter";
import { createNominatimGeocode } from "./nominatim";
import { createDeepLTranslation } from "./deepl";
import { createGoogleVisionOcr } from "./google-vision";
import type { Providers } from "./types";
import { createOsrmRouting, mockRouting, type RoutingProvider } from "./routing";

export interface ProviderEnv {
  GEOCODE_PROVIDER?: string;
  FX_PROVIDER?: string;
  TRANSLATION_PROVIDER?: string;
  OCR_PROVIDER?: string;
  ROUTING_PROVIDER?: string;
  OSRM_URL?: string;
  DEEPL_API_KEY?: string;
  GOOGLE_VISION_API_KEY?: string;
  SITE_URL?: string;
}

/** Which adapter each slot resolved to, for the health check and the startup log. */
export interface ProviderNames { geocode: string; fx: string; translation: string; ocr: string; routing: string }

/**
 * Resolve providers from env. Server-side only.
 *
 * An explicit `*_PROVIDER` always wins ("mock" included, for tests). Otherwise:
 * - `live: false` (demo mode, unit and e2e tests) → the deterministic mocks;
 * - `live: true` (a real deployment) → the keyless real services (Frankfurter, Nominatim, OSRM),
 *   and DeepL / Google Vision whenever their key is set. Without a key those two stay on the
 *   mock, which never invents a translation and is labelled as demo output in the UI.
 */
export function resolveProviders(env: ProviderEnv & { live?: boolean }): Providers & { routing: RoutingProvider; names: ProviderNames } {
  const live = env.live ?? false;
  const pick = (explicit: string | undefined, real: string, hasKey = true) => explicit || (live && hasKey ? real : "mock");
  const names: ProviderNames = {
    routing: pick(env.ROUTING_PROVIDER, "osrm"),
    geocode: pick(env.GEOCODE_PROVIDER, "nominatim"),
    fx: pick(env.FX_PROVIDER, "frankfurter"),
    translation: env.TRANSLATION_PROVIDER || (env.DEEPL_API_KEY && live ? "deepl" : "mock"),
    ocr: env.OCR_PROVIDER || (env.GOOGLE_VISION_API_KEY && live ? "google-vision" : "mock"),
  };
  const need = (key: string | undefined, name: string) => { if (!key) throw new Error(`${name} is required for this provider`); return key; };
  return {
    names,
    routing: names.routing === "osrm" ? createOsrmRouting({ endpoint: env.OSRM_URL }) : mockRouting,
    geocode: names.geocode === "nominatim" ? createNominatimGeocode({ userAgent: `Get Going/0.1 (${env.SITE_URL ?? "dev"})` }) : mockProviders.geocode,
    fx: names.fx === "frankfurter" ? createFrankfurterFx() : mockProviders.fx,
    translation: names.translation === "deepl" ? createDeepLTranslation({ apiKey: need(env.DEEPL_API_KEY, "DEEPL_API_KEY") }) : mockProviders.translation,
    ocr: names.ocr === "google-vision" ? createGoogleVisionOcr({ apiKey: need(env.GOOGLE_VISION_API_KEY, "GOOGLE_VISION_API_KEY") }) : mockProviders.ocr,
  };
}
