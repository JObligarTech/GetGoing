import { createOsrmRouting, mockRouting, type RoutingProvider } from "@voya/core";

/**
 * Directions run on the device. With no OSRM URL configured the deterministic mock
 * provider is used (works offline, in Expo Go and in tests); transit always comes
 * from the mock until a transit provider is wired in.
 */
const OSRM_URL = process.env.EXPO_PUBLIC_OSRM_URL ?? "";
export const routing: RoutingProvider = OSRM_URL ? createOsrmRouting({ endpoint: OSRM_URL }) : mockRouting;
