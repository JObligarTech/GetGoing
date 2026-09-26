import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
export const metadata: Metadata = { title: "Atlas Premium Pass" };
/** Checkout (Single trip $2.99 · Monthly $4.99 · Yearly $49.99), gifting and redeem land in the next round with the payment provider. */
export default function PassPage() {
  return <ComingSoon title="Atlas Premium Pass" premium blurb="Checkout, gifting a trip for 3 days and redeeming a gift arrive in the next round, once a payment provider is chosen. Passes are stored as entitlements the database already understands." />;
}
