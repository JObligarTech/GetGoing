import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Bookmark, Compass, Home as HomeIcon, Languages, Phone } from "lucide-react";
import { categoriesForPlace, formatDateRange, formatTime, placeColor } from "@voya/core";
import { Map } from "@/components/map/Map";
import { LocalAddress } from "@/components/plan/LocalAddress";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Chip, IconCoin, ListRow, SectionHeader, Tile } from "@/components/ui/primitives";
import { getActiveTrip, getTripBundle } from "@/lib/data";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const b = active ? await getTripBundle(active.id) : null;
  return { title: b?.places.find((p) => p.id === id)?.name ?? "Place" };
}

/** Saved place / accommodation details with the cross-feature actions from the brief. */
export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  const place = bundle?.places.find((p) => p.id === id);
  if (!bundle || !place) notFound();
  const stay = bundle.stays.find((s) => s.place_id === place.id);
  const cats = categoriesForPlace(bundle, place.id);
  const color = placeColor(bundle, place);
  const hasLoc = place.lat != null && place.lng != null;
  const lang = bundle.trip.local_language === "ja" ? "日本語" : (bundle.trip.local_language ?? "local language");
  const tz = bundle.trip.local_tz ?? user.profile.home_tz;

  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="relative h-[200px] overflow-hidden rounded-3xl border border-line bg-tint">
          {hasLoc ? (
            <Map center={{ lat: place.lat!, lng: place.lng! }} zoom={15} static pins={[{ id: place.id, lat: place.lat!, lng: place.lng!, label: place.name, color, dark: Boolean(stay) }]} label={`Map showing ${place.name}`} className="absolute inset-0" />
          ) : (
            <Tile name={place.name} size={200} radius={0} color={color} className="w-full" />
          )}
        </div>
        <header className="flex items-start gap-3">
          <Tile name={place.name} size={52} color={color} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-muted">{stay ? "Your stay" : cats.map((c) => c.name).join(" · ") || (place.priority === "must" ? "Must visit" : "Saved place")}</p>
            <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">{place.name}</h1>
            {place.local_name && <p className="text-[15px] text-muted" lang={bundle.trip.local_language ?? undefined}>{place.local_name}</p>}
          </div>
          {place.priority === "must" && !stay && <Chip>Must visit</Chip>}
        </header>

        <div className="flex gap-2">
          <Button href={`/navigate/route?to=${place.id}`} variant="ink" full icon={<Compass size={18} />}>{stay ? "Take me back to my hotel" : "Navigate"}</Button>
          <Button variant="secondary" aria-label={`${place.name} is saved`} aria-pressed icon={<Bookmark size={18} className="fill-current text-primary" />}><span className="sr-only">Saved</span></Button>
        </div>

        {stay && (
          <>
            <SectionHeader title="Booking" />
            <Card className="divide-y divide-line">
              <ListRow leading={<IconCoin><HomeIcon size={20} /></IconCoin>} title={formatDateRange(stay.check_in?.slice(0, 10) ?? null, stay.check_out?.slice(0, 10) ?? null)} subtitle={`${stay.kind[0]!.toUpperCase()}${stay.kind.slice(1)}${stay.check_in ? ` · Check-in ${formatTime(new Date(stay.check_in), tz)}` : ""}${stay.check_out ? ` · Check-out ${formatTime(new Date(stay.check_out), tz)}` : ""}`} />
              {stay.confirmation && <ListRow title="Confirmation" trailing={<span className="font-mono text-[13px] font-bold">{stay.confirmation}</span>} />}
            </Card>
          </>
        )}

        <SectionHeader title="Address" />
        <Card className="divide-y divide-line">
          {place.address && <ListRow title={place.address} subtitle="Tap to copy" />}
          {place.local_address && (
            <LocalAddress label={`Show address in ${lang}`} lang={bundle.trip.local_language ?? undefined} name={place.local_name ?? place.name} address={place.local_address} icon={<IconCoin><Languages size={20} /></IconCoin>} />
          )}
          {place.phone && <ListRow href={`tel:${place.phone}`} leading={<IconCoin><Phone size={20} /></IconCoin>} title={place.phone} subtitle="Call" />}
        </Card>

        {place.notes && (<><SectionHeader title="Notes" /><Card className="px-3.5 py-3 text-[14px] whitespace-pre-wrap">{place.notes}</Card></>)}
        <Button href="/plan" variant="ghost">Back to Plan</Button>
      </FadeIn>
    </Page>
  );
}
