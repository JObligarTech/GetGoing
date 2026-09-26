import { Camera, Gift, Link2, Sparkles, Wallet } from "lucide-react";
import { PASS_PRICES } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/primitives";

/** Split, locked (mockup 5a): what the pass unlocks, the three tiers, and the gift path. */
export function PassGate({ localCurrency, homeCurrency }: { localCurrency: string | null; homeCurrency: string }) {
  const rows = [
    [Camera, "Items, tax and tip read from a photo"],
    [Link2, "Friends claim what they ordered by link, no account"],
    [Wallet, `Totals in ${localCurrency ?? "the local currency"} and your home ${homeCurrency}`],
  ] as const;
  return (
    <section aria-labelledby="gate-title" className="flex flex-col gap-3.5">
      <Card className="flex flex-col gap-4 p-5">
        <Chip tone="premium" className="self-start"><Sparkles size={13} aria-hidden="true" className="mr-1" />Atlas Premium Pass</Chip>
        <h2 id="gate-title" className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-balance">Scan the receipt.<br />Everyone pays their share.</h2>
        <ul className="flex flex-col gap-2.5">
          {rows.map(([Icon, text]) => (
            <li key={text} className="flex items-center gap-3 text-[14px] font-semibold">
              <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-premium-bg text-premium-text"><Icon size={18} /></span>{text}
            </li>
          ))}
        </ul>
        <Button href="/pass" size="cta" full>Get Atlas Premium Pass · from ${PASS_PRICES.trip.price}</Button>
        <p className="text-center text-[12.5px] font-semibold text-muted">{PASS_PRICES.trip.label} ${PASS_PRICES.trip.price} · {PASS_PRICES.monthly.label} ${PASS_PRICES.monthly.price} · {PASS_PRICES.yearly.label} ${PASS_PRICES.yearly.price}</p>
      </Card>
      <Card className="flex items-center gap-3 p-4">
        <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-tint text-primary"><Gift size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Been gifted access?</p>
          <p className="text-[12px] text-muted">Monthly and yearly members can gift one trip 3 days of Atlas Premium Pass. Extend for $0.99 if you need longer.</p>
        </div>
        <Button href="/pass?redeem=1" variant="secondary" size="sm">Redeem</Button>
      </Card>
    </section>
  );
}
