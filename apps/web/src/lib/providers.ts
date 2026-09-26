import "server-only";
import { createFxCache, resolveProviders } from "@voya/core";
import { serverEnv } from "@/lib/env";

/**
 * Server-side translation, OCR and FX providers (mocks unless configured in env).
 * Provider keys never reach the browser: every call goes through a server action that
 * checks the session and a per-user rate limit first.
 */
const providers = resolveProviders({ ...serverEnv, ROUTING_PROVIDER: process.env.ROUTING_PROVIDER, OSRM_URL: process.env.OSRM_URL });
export const translation = providers.translation;
export const ocr = providers.ocr;
/** Rates are cached for an hour per instance and served stale when the provider is unreachable. */
export const fx = createFxCache(providers.fx, { ttlMs: 60 * 60 * 1000 });
