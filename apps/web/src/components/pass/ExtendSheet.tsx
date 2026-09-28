"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { EXTENSION_MAX_DAYS, EXTENSION_PRICE, PAYMENT_METHOD_LABEL, extensionCoverage, formatMoney, type PaymentMethod, type TripRow } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import type { PurchaseState } from "@/app/(app)/pass/actions";
import { cx } from "@/lib/utils";

const METHODS: PaymentMethod[] = ["apple_pay", "google_pay", "card"];

/** Extend a gifted pass (mockup 8c): 1–7 days, same price for any length, one-time. */
export function ExtendSheet({ trip, tz, giftEndsAt, localPrice, action, demo }: {
  trip: Pick<TripRow, "id" | "end_date" | "cities">; tz: string; giftEndsAt: string;
  localPrice: { amount: number; currency: string } | null;
  action: (prev: PurchaseState, fd: FormData) => Promise<PurchaseState>; demo: boolean;
}) {
  const [days, setDays] = useState(EXTENSION_MAX_DAYS);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [state, submit, pending] = useActionState(action, null);
  const coverage = extensionCoverage(new Date(giftEndsAt), days, trip, tz);
  return (
    <form action={submit} className="flex flex-col gap-3.5">
      <input type="hidden" name="tripId" value={trip.id} />
      <input type="hidden" name="days" value={days} />
      <input type="hidden" name="method" value={method} />
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted">Extend by</p>
        <div role="radiogroup" aria-label="Extend by" className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: EXTENSION_MAX_DAYS }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={days === d} aria-label={`${d} day${d > 1 ? "s" : ""}`} onClick={() => setDays(d)} className={cx("h-11 rounded-lg border text-[14px] font-bold transition-colors duration-(--dur-fast)", days === d ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-tint")}>{d}d</button>
          ))}
        </div>
        <p className="text-[13px] text-muted">Same price for any length up to {EXTENSION_MAX_DAYS} days. {coverage.text}</p>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between"><span className="text-[15px] font-bold">Extension · {days} day{days > 1 ? "s" : ""}</span><span className="text-[22px] font-extrabold">${EXTENSION_PRICE}</span></div>
        <p className="text-[12.5px] text-muted">One-time, never renews{localPrice ? ` · ≈ ${formatMoney(localPrice.amount, localPrice.currency)}` : ""}</p>
        <div role="radiogroup" aria-label="Pay with" className="flex flex-wrap gap-2">
          {METHODS.map((m) => <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cx("h-10 rounded-lg border px-3.5 text-[13px] font-bold", method === m ? "border-primary bg-tint text-on-tint" : "border-line-strong bg-surface text-ink hover:bg-tint/60")}>{PAYMENT_METHOD_LABEL[m]}</button>)}
        </div>
        {state?.error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{state.error}</p>}
        <Button type="submit" size="cta" full loading={pending}>Pay · ${EXTENSION_PRICE}</Button>
        <p className="text-center text-[12px] text-muted">{demo ? "Demo: nothing is charged. " : ""}Or get the full single-trip pass · <Link href="/pass?plan=trip" className="font-bold text-primary">$2.99</Link> for the whole trip.</p>
      </Card>
    </form>
  );
}
