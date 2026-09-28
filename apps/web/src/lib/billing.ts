import "server-only";
import { createMockBilling, unavailableBilling, type BillingProvider } from "@voya/core";
import { isDemo } from "@/lib/env";
import { now } from "@/lib/data";

/**
 * Demo mode pays with the mock and grants in the sandbox. Real mode has no adapter yet:
 * purchases report "unavailable" and entitlements come only from the billing webhook
 * (supabase/functions/billing-webhook) once a vendor is configured.
 */
export const billing: BillingProvider = isDemo ? createMockBilling({ now }) : unavailableBilling;
