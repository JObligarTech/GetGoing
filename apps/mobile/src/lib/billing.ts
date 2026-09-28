import { createMockBilling, unavailableBilling, type BillingProvider } from "@voya/core";
import { isDemo } from "./supabase";

/**
 * Demo mode pays with the mock and grants in memory. A real build gets a store-billing adapter
 * (App Store / Play through RevenueCat or StoreKit) whose server-side webhook grants the
 * entitlement; the app never writes entitlements itself.
 */
export const billing: BillingProvider = isDemo ? createMockBilling() : unavailableBilling;
