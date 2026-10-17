import "server-only";
import { createFxCache, resolveProviders } from "@voya/core";
import { isDemo, serverEnv } from "@/lib/env";

/**
 * Server-side translation, OCR, FX, place search and routing.
 *
 * Demo mode and tests use the deterministic mocks. A real deployment uses Frankfurter (rates),
 * Nominatim (place search) and OSRM (walk / cycle / drive) out of the box, DeepL when
 * DEEPL_API_KEY is set and Google Vision when GOOGLE_VISION_API_KEY is set. Any `*_PROVIDER`
 * variable overrides the choice. The keys are read here, in a server-only module, and never
 * reach the browser: every call goes through a server action or /api/v1 route that checks the
 * session and a per-user rate limit first.
 */
const providers = resolveProviders({
  ...serverEnv,
  live: !isDemo,
  OCR_PROVIDER: process.env.OCR_PROVIDER,
  ROUTING_PROVIDER: process.env.ROUTING_PROVIDER,
  OSRM_URL: process.env.OSRM_URL,
  DEEPL_API_KEY: process.env.DEEPL_API_KEY,
  GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY,
});

if (!isDemo && process.env.NODE_ENV === "production") {
  const missing = [providers.names.translation === "mock" && "DEEPL_API_KEY", providers.names.ocr === "mock" && "GOOGLE_VISION_API_KEY"].filter(Boolean);
  if (missing.length) console.warn(`[providers] ${missing.join(" and ")} not set: translation / photo reading stay on the offline demo phrasebook.`);
}

export const providerNames = providers.names;
export const translation = providers.translation;
export const ocr = providers.ocr;
export const geocode = providers.geocode;
export const routing = providers.routing;
/** Rates are cached for an hour per instance and served stale when the provider is unreachable. */
export const fx = createFxCache(providers.fx, { ttlMs: 60 * 60 * 1000 });
