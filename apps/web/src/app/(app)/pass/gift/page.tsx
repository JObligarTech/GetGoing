import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { activePass, canGift, giftCandidates, giftStatusLabel, kindLabel, midnightAfter, GIFT_DAYS } from "@voya/core";
import { GiftPicker, GiftSent } from "@/components/pass/GiftPicker";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { PassChip } from "@/components/ui/PassMark";
import { PageHeader } from "@/components/ui/primitives";
import { createGiftAction } from "@/app/(app)/pass/actions";
import { getActiveTrip, getEntitlements, getTripBundle, now } from "@/lib/data";
import { publicEnv } from "@/lib/env";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Gift 3 days" };

/** Member's gift picker (mockup 8c): one traveler on the active trip, 3 days, resets each trip. */
export default async function GiftPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) redirect("/pass");
  const at = now();
  const entitlements = await getEntitlements();
  const pass = activePass(entitlements, active.id, at);
  const allowed = canGift(entitlements, active.id, bundle.passGifts, user.id, at);
  const tz = active.local_tz ?? user.profile.home_tz;
  const city = active.cities[0] ?? active.name;
  const endsPreview = `midnight ${city}`;
  const candidates = giftCandidates(bundle.travelers, bundle.passMarks, user.id);
  const mine = bundle.passGifts.find((g) => g.giver_id === user.id && g.status !== "revoked");
  const recipient = mine ? bundle.travelers.find((t) => t.id === mine.traveler_id)?.name.split(" ")[0] ?? "them" : "";
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href="/pass" variant="secondary" size="sm" aria-label="Back to Atlas Premium Pass" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <PageHeader eyebrow={pass ? `Atlas Premium Pass · ${kindLabel(pass.kind)}` : "Atlas Premium Pass"} title={`Gift ${GIFT_DAYS} days`} action={<PassChip>{allowed.ok ? "1 gift available" : "Used"}</PassChip>} />
        </div>
        <p className="text-[14px] text-muted">Give a traveler on {active.name} full Atlas Premium Pass for {GIFT_DAYS} days. Resets with each new trip.{" "}<span className="sr-only">Ends {midnightAfter(at, tz, GIFT_DAYS).toISOString()} if accepted today.</span></p>
        {allowed.ok
          ? <GiftPicker tripId={active.id} tripName={active.name} candidates={candidates} endsPreview={endsPreview} action={createGiftAction} />
          : mine
            ? <GiftSent url={`${publicEnv.NEXT_PUBLIC_SITE_URL}/gift/${mine.code}`} name={recipient} tripName={active.name} status={giftStatusLabel(mine, recipient, at) + "."} />
            : <p role="status" className="rounded-lg bg-tint px-3.5 py-3 text-[13px] font-semibold text-on-tint">{allowed.reason}</p>}
      </FadeIn>
    </Page>
  );
}
