import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EXTENSION_PRICE, convert, daysLeft, formatEnds } from "@voya/core";
import { ExtendSheet } from "@/components/pass/ExtendSheet";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { PassChip } from "@/components/ui/PassMark";
import { PageHeader } from "@/components/ui/primitives";
import { extendAction } from "@/app/(app)/pass/actions";
import { getActiveTrip, getEntitlements, now } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { fx } from "@/lib/providers";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Extend your gifted pass" };

/** Recipient extends the gift (mockup 8c): only for gifted passes on the active trip. */
export default async function ExtendPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  if (!active) redirect("/pass");
  const at = now();
  const gifted = (await getEntitlements()).filter((e) => e.trip_id === active.id && (e.kind === "gift" || e.kind === "extension")).sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0];
  if (!gifted) redirect("/pass");
  const tz = active.local_tz ?? user.profile.home_tz;
  const ends = new Date(gifted.ends_at);
  const left = daysLeft(gifted, at);
  const local = active.local_currency && active.local_currency !== "USD" ? await fx.rate("USD", active.local_currency).then((r) => ({ amount: convert(EXTENSION_PRICE, r.rate, active.local_currency!), currency: active.local_currency! })).catch(() => null) : null;
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href="/split" variant="secondary" size="sm" aria-label="Back to Split" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <PageHeader eyebrow={`${active.name} · Tools`} title="Split" action={<PassChip mark="gifted">{left <= 1 ? "ends tonight" : `${left}d left`}</PassChip>} />
        </div>
        <section className="rounded-2xl bg-button-ink p-5 text-on-button-ink">
          <h2 className="text-[20px] leading-tight font-extrabold tracking-[-0.02em]">{ends.getTime() > at.getTime() ? `Your gifted pass ends ${left <= 1 ? "at midnight" : formatEnds(ends, tz)}` : "Your gifted pass has ended"}</h2>
          <p className="mt-1 text-[13.5px] opacity-85">Keep Atlas Premium Pass for the rest of the trip for ${EXTENSION_PRICE}.</p>
        </section>
        <ExtendSheet trip={{ id: active.id, end_date: active.end_date, cities: active.cities }} tz={tz} giftEndsAt={new Date(Math.max(ends.getTime(), at.getTime())).toISOString()} localPrice={local} action={extendAction} demo={isDemo} />
      </FadeIn>
    </Page>
  );
}
