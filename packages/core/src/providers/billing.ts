/**
 * Billing provider interface. The app never sees card details: a real adapter (Stripe
 * Checkout, RevenueCat, App Store / Play billing) hands the buyer to the vendor and the
 * vendor's webhook grants the entitlement with the service role (see
 * supabase/functions/billing-webhook). The mock takes "payment" instantly and is honoured
 * only in demo mode.
 */
import { EXTENSION_PRICE, planById, type PassPlanId } from "../pass";

export type PurchasePlan = PassPlanId | "extension";
export type PaymentMethod = "card" | "apple_pay" | "google_pay";
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { card: "Card", apple_pay: "Apple Pay", google_pay: "Google Pay" };

export interface PurchaseRequest { plan: PurchasePlan; userId: string; tripId: string | null; days?: number; method: PaymentMethod }
export interface PurchaseReceipt {
  provider: string;
  receiptId: string;
  plan: PurchasePlan;
  userId: string;
  tripId: string | null;
  days: number | null;
  amount: number;
  currency: "USD";
  /** "Apple Pay ·· 4421" — what the confirmation shows; never a full card number. */
  paidWith: string;
  paidAt: string;
}
export type PurchaseResult = { status: "paid"; receipt: PurchaseReceipt } | { status: "redirect"; url: string } | { status: "unavailable"; message: string };

export interface BillingProvider {
  readonly name: string;
  purchase(req: PurchaseRequest): Promise<PurchaseResult>;
  /** Previously paid receipts for this user, e.g. after reinstalling. */
  restore(userId: string): Promise<PurchaseReceipt[]>;
}

export function priceFor(plan: PurchasePlan): number {
  return plan === "extension" ? EXTENSION_PRICE : planById(plan)?.price ?? 0;
}

/** Instant, deterministic "payment" for dev, demo and tests. Receipts are kept in memory so restore() works within a process. */
export function createMockBilling(opts: { now?: () => Date; last4?: string; randomId?: () => string } = {}): BillingProvider {
  const receipts: PurchaseReceipt[] = [];
  const now = opts.now ?? (() => new Date());
  const id = opts.randomId ?? (() => globalThis.crypto.randomUUID());
  return {
    name: "mock",
    async purchase(req) {
      if (req.plan === "extension" && !(req.days && req.days >= 1 && req.days <= 7)) return { status: "unavailable", message: "Extensions run 1 to 7 days." };
      const receipt: PurchaseReceipt = {
        provider: "mock", receiptId: `mock_${id()}`, plan: req.plan, userId: req.userId, tripId: req.tripId, days: req.plan === "extension" ? req.days ?? null : null,
        amount: priceFor(req.plan), currency: "USD", paidWith: `${PAYMENT_METHOD_LABEL[req.method]} ·· ${opts.last4 ?? "4421"}`, paidAt: now().toISOString(),
      };
      receipts.push(receipt);
      return { status: "paid", receipt };
    },
    async restore(userId) { return receipts.filter((r) => r.userId === userId); },
  };
}

/** The production default until a vendor adapter is configured: nothing is charged, the UI explains. */
export const unavailableBilling: BillingProvider = {
  name: "unavailable",
  async purchase() { return { status: "unavailable", message: "Payments aren't connected yet. Passes can be granted by the billing webhook once a provider is configured." }; },
  async restore() { return []; },
};
