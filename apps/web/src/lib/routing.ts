import "server-only";
import { resolveProviders } from "@voya/core";
import { serverEnv } from "@/lib/env";

/** Server-side routing provider (mock unless ROUTING_PROVIDER=osrm). Never called from the client. */
export const routing = resolveProviders({ ...serverEnv, ROUTING_PROVIDER: process.env.ROUTING_PROVIDER, OSRM_URL: process.env.OSRM_URL }).routing;
