import type { Metadata } from "next";
import { suggestLanguages, type CachedRate } from "@voya/core";
import { CameraTranslate } from "@/components/translate/CameraTranslate";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { recognizeAction } from "@/app/(app)/translate/actions";
import { getActiveTrip } from "@/lib/data";
import { fx } from "@/lib/providers";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Camera translation" };

/** Camera: menus, signs and receipts, read from a photo. The trip's language is the source. */
export default async function CameraPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  if (!active) return <Page><PageHeader eyebrow="Translate" title="No active trip" /><EmptyState title="Create a trip first" action={<Button href="/trips/new">Create a trip</Button>} /></Page>;
  const pair = suggestLanguages(active, user.profile);
  let rate: CachedRate | null = null;
  if (active.local_currency && active.local_currency !== user.profile.home_currency) {
    try { rate = await fx.rate(active.local_currency, user.profile.home_currency); } catch { rate = null; }
  }
  return (
    <CameraTranslate tripName={active.name} from={pair.to.code} to={pair.from.code} localCurrency={active.local_currency} homeCurrency={user.profile.home_currency} rate={rate} recognizeAction={recognizeAction} />
  );
}
