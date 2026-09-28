import type { Metadata } from "next";
import { Gift, Receipt, RotateCcw } from "lucide-react";
import { activePass, canGift, endedPass, giftStatusLabel, kindLabel, passSummary } from "@voya/core";
import { Checkout } from "@/components/pass/Checkout";
import { RedeemForm } from "@/components/pass/RedeemForm";
import { RestoreButton } from "@/components/pass/RestoreButton";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { PassChip, PassStar } from "@/components/ui/PassMark";
import { Card, ListRow, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { purchaseAction, restoreAction } from "@/app/(app)/pass/actions";
import { getActiveTrip, getEntitlements, getTripBundle, now } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Atlas Premium Pass" };

/** Checkout when there's no pass (mockup 7a); the pass itself, gifts and restore when there is. */
export default async function PassPage({ searchParams }: { searchParams: Promise<{ redeem?: string; error?: string; plan?: string }> }) {
  const { redeem, error, plan } = await searchParams;
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  const entitlements = await getEntitlements();
  const at = now();
  const tz = active?.local_tz ?? user.profile.home_tz;
  const pass = activePass(entitlements, active?.id ?? null, at);
  const ended = endedPass(entitlements, active?.id ?? null, at);
  const back = <Button href="/split" variant="ghost" size="sm">Cancel</Button>;

  if (!pass) {
    return (
      <Page>
        <FadeIn className="flex flex-col gap-3.5">
          <PageHeader eyebrow={active ? `${active.name} · Tools` : "Tools"} title="Choose your Atlas Premium Pass" action={back} wrap />
          {ended && <p role="status" className="rounded-lg bg-tint px-3.5 py-3 text-[13px] font-semibold text-on-tint">Your {kindLabel(ended.kind).toLowerCase()} pass ended. Your bills stay readable and shareable.</p>}
          {redeem && <RedeemForm error={error === "code"} />}
          <Checkout trip={active ? { id: active.id, name: active.name, start_date: active.start_date, end_date: active.end_date } : null} action={purchaseAction} demo={isDemo} initialPlan={plan === "trip" || plan === "monthly" ? plan : "yearly"} />
          <div className="flex items-center justify-between text-[12.5px] font-semibold text-muted">
            {!redeem && <Button href="/pass?redeem=1" variant="ghost" size="sm" icon={<Gift size={16} />}>Redeem a gift</Button>}
            <RestoreButton action={restoreAction} />
          </div>
        </FadeIn>
      </Page>
    );
  }

  const summary = passSummary(pass, at, tz);
  const gifting = active && bundle ? canGift(entitlements, active.id, bundle.passGifts, user.id, at) : { ok: false as const, reason: "Pick a trip first." };
  const myGifts = bundle?.passGifts.filter((g) => g.giver_id === user.id) ?? [];
  const isGifted = pass.kind === "gift" || pass.kind === "extension";
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <PageHeader eyebrow="Account" title="Atlas Premium Pass" action={<PassChip mark={isGifted ? "gifted" : "pass"}>{isGifted ? "Gifted" : undefined}</PassChip>} />
        <Card className="flex flex-col gap-1 p-4">
          <p className="flex items-center gap-2 text-[18px] font-extrabold"><PassStar size={16} className="text-premium" />{summary.title}</p>
          <p className="text-[13px] text-muted">{summary.detail}{pass.paid_with ? ` · paid with ${pass.paid_with}` : ""}</p>
          <p className="text-[13px] text-muted">Split, Navigate trees, Translate and Currency are unlocked{pass.trip_id ? ` on ${active?.name ?? "this trip"}` : " on every trip"}.</p>
        </Card>
        {isGifted && active && (
          <Card className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">Need longer?</p><p className="text-[12px] text-muted">Extend up to 7 days for $0.99, or get the full single-trip pass for $2.99.</p></div>
            <Button href="/pass/extend" size="sm">Extend</Button>
          </Card>
        )}
        {(pass.kind === "monthly" || pass.kind === "yearly") && (
          <>
            <SectionHeader title="Gifting" />
            <Card className="divide-y divide-line">
              {gifting.ok
                ? <ListRow href="/pass/gift" leading={<span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-premium-bg text-premium-text"><Gift size={20} /></span>} title="Gift 3 days" subtitle={`1 gift available on ${active?.name}. Resets with each new trip.`} chevron />
                : <ListRow leading={<span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-tint text-primary"><Gift size={20} /></span>} title="Gift 3 days" subtitle={gifting.reason} />}
              {myGifts.map((g) => <ListRow key={g.id} title={giftStatusLabel(g, bundle?.travelers.find((t) => t.id === g.traveler_id)?.name ?? "them", at)} subtitle={g.status === "sent" ? `Link works until ${new Date(g.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : undefined} />)}
            </Card>
          </>
        )}
        <SectionHeader title="Receipts" />
        <Card className="divide-y divide-line">
          {entitlements.map((e) => <ListRow key={e.id} leading={<span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-tint text-primary"><Receipt size={20} /></span>} title={`${kindLabel(e.kind)}${e.amount != null ? ` · $${e.amount.toFixed(2)}` : " · free"}`} subtitle={`${new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${e.paid_with ? ` · ${e.paid_with}` : ""}`} />)}
        </Card>
        <div className="flex items-center justify-between">
          <Button href="/pass?redeem=1" variant="ghost" size="sm" icon={<Gift size={16} />}>Redeem a gift</Button>
          <RestoreButton action={restoreAction} icon={<RotateCcw size={14} />} />
        </div>
        {redeem && <RedeemForm error={error === "code"} />}
      </FadeIn>
    </Page>
  );
}
