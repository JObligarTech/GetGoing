import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, MapPinned } from "lucide-react";
import { driverCard } from "@voya/core";
import { DriverCardView } from "@/components/translate/DriverCardView";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { PageHeader } from "@/components/ui/primitives";
import { getActiveTrip, getTripBundle } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Show to driver" };

const qs = z.object({ place: z.uuid() });

/** "Show to driver": the place's local-script name and address, big, on a dark card. */
export default async function DriverPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = qs.safeParse(await searchParams);
  if (!q.success) notFound();
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  const place = bundle?.places.find((p) => p.id === q.data.place);
  if (!bundle || !place) notFound();
  const card = driverCard(place, bundle.trip);
  const isStay = bundle.stays.some((s) => s.place_id === place.id);
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href="/translate" variant="secondary" size="sm" aria-label="Back to Translate" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <PageHeader eyebrow={isStay ? "Your stay" : bundle.trip.name} title="Show to driver" />
        </div>
        <DriverCardView card={card} />
        <div className="flex flex-wrap gap-2">
          <Button href={`/navigate/route?to=${place.id}&mode=drive`} variant="secondary" icon={<MapPinned size={18} />}>Show map</Button>
          <Button href={`/plan/place/${place.id}`} variant="ghost">Place details</Button>
        </div>
        <p className="text-[12.5px] text-muted">Hold the card up, or tap Speak. The address comes from the place you saved; edit the place to change it.</p>
      </FadeIn>
    </Page>
  );
}
