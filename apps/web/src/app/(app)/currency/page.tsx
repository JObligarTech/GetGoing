import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
export const metadata: Metadata = { title: "Currency" };
export default function CurrencyPage() {
  return <ComingSoon title="Currency" premium blurb="USD ⇄ JPY with live rates from the trip's currency, quick amounts and a keypad. The FX provider interface and mock adapter are already in @voya/core." />;
}
