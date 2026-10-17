import { createOsrmRouting, mockRouting, type RoutingProvider } from "@voya/core";
import { isDemo } from "./supabase";

/**
 * Directions run on the device with coordinates only. A real build (Supabase configured) uses
 * OSRM for walk / cycle / drive — EXPO_PUBLIC_OSRM_URL, or the public OSRM server when unset.
 * Demo mode, Expo Go previews and tests use the deterministic mock. Transit always comes from
 * the mock (labelled "estimated") until a transit provider is wired in.
 */
const OSRM_URL = process.env.EXPO_PUBLIC_OSRM_URL ?? "";
export const routing: RoutingProvider = OSRM_URL || !isDemo ? createOsrmRouting({ endpoint: OSRM_URL || undefined }) : mockRouting;
