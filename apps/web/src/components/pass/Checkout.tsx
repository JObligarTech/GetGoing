"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PASS_PLANS, PAYMENT_METHOD_LABEL, planBlurb, type PassPlanId, type PaymentMethod } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/primitives";
import { PassStar } from "@/components/ui/PassMark";
import type { PurchaseState } from "@/app/(app)/pass/actions";
import { cx } from "@/lib/utils";

const METHODS: PaymentMethod[] = ["apple_pay", "google_pay", "card"];

/**
 * Atlas Premium Pass checkout (mockup 7a): three plans as a radio group, the way to pay, one
 * Pay button. Card details never touch Get Going: a real provider takes them on its own sheet.
 */
export function Checkout({ trip, action, demo, initialPlan = "yearly" }: {
  trip: { id: string; name: string; start_date: string | null; end_date: string | null } | null;
  action: (prev: PurchaseState, fd: FormData) => Promise<PurchaseState>;
  demo: boolean;
  initialPlan?: PassPlanId;
}) {
  const [plan, setPlan] = useState<PassPlanId>(trip ? initialPlan : initialPlan === "trip" ? "yearly" : initialPlan);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [state, submit, pending] = useActionState(action, null);
  const chosen = PASS_PLANS.find((p) => p.id === plan)!;
  return (
    <form action={submit} className="flex flex-col gap-3.5">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="tripId" value={trip?.id ?? ""} />
      <input type="hidden" name="method" value={method} />
      <div role="radiogroup" aria-label="Plan" className="flex flex-col gap-2.5">
        {PASS_PLANS.map((p) => {
          const active = p.id === plan;
          const disabled = p.id === "trip" && !trip;
          return (
            <button
              key={p.id} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => setPlan(p.id)}
              aria-label={`${p.label}${p.id === "trip" && trip ? ` · ${trip.name}` : ""}, $${p.price} ${p.period}`}
              className={cx("card flex items-center gap-3 p-4 text-left transition-colors duration-(--dur-fast)", active ? "border-primary bg-tint/40" : "hover:bg-tint/40", disabled && "opacity-50")}
            >
              <span aria-hidden="true" className={cx("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", active ? "border-primary bg-primary text-on-primary" : "border-line-strong")}>{active && <Check size={14} strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[16px] font-extrabold">{p.label}{p.id === "trip" && trip ? <span className="truncate font-semibold text-muted">· {trip.name}</span> : null}{p.save && <Chip tone="premium" className="h-5 px-1.5 text-[10px] uppercase">{p.save}</Chip>}</span>
                <span className="block text-[12.5px] text-muted">{planBlurb(p.id, trip)}</span>
              </span>
              <span className="text-right"><span className="block text-[18px] font-extrabold">${p.price}</span><span className="block text-[11.5px] text-muted">{p.period}</span></span>
            </button>
          );
        })}
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted">Pay with</p>
        <div role="radiogroup" aria-label="Pay with" className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cx("h-10 rounded-lg border px-3.5 text-[13px] font-bold transition-colors duration-(--dur-fast)", method === m ? "border-primary bg-tint text-on-tint" : "border-line-strong bg-surface text-ink hover:bg-tint/60")}>
              {PAYMENT_METHOD_LABEL[m]}
            </button>
          ))}
        </div>
        {state?.error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{state.error}</p>}
        <Button type="submit" size="cta" full loading={pending} icon={<PassStar size={14} />}>Pay · ${chosen.price}</Button>
        <p className="text-center text-[11.5px] leading-relaxed text-muted">
          {demo ? "Demo: nothing is charged. " : "Billed by our payment provider. "}Single-trip passes end automatically. Monthly and yearly renew until cancelled. <Link href="/legal/terms" className="font-bold text-primary">Terms</Link>
        </p>
      </Card>
    </form>
  );
}
