import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Home as HomeIcon, Users } from "lucide-react";
import { formatDateRange, formatTime, placeById, pluralize, tripDates, tripPhaseLabel } from "@voya/core";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Chip, IconCoin, ListRow, SectionHeader, Tile } from "@/components/ui/primitives";
import { setActiveTrip } from "@/app/(app)/actions";
import { getActiveTrip, getTripBundle, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const b = z.uuid().safeParse(id).success ? await getTripBundle(id) : null;
  return { title: b?.trip.name ?? "Trip" };
}

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const [bundle, active] = await Promise.all([getTripBundle(id), getActiveTrip(user.profile.home_tz)]);
  if (!bundle) notFound(); // RLS returns nothing for trips you can't see → 404, not 403 (no existence leak)
  const { trip, travelers, places, stays } = bundle;
  const isActive = active?.id === trip.id;
  const days = tripDates(trip).length;

  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <header className="flex items-center gap-3.5">
          <Tile name={trip.name} size={64} radius={16} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-muted">{trip.cities.join(" → ") || "No cities yet"}</p>
            <h1 className="truncate text-[26px] font-extrabold tracking-[-0.02em]">{trip.name}</h1>
            <p className="text-[12.5px] text-muted">{formatDateRange(trip.start_date, trip.end_date)}{days ? ` · ${pluralize(days, "day")}` : ""}</p>
          </div>
          <Chip>{tripPhaseLabel(trip, now(), trip.local_tz ?? undefined)}</Chip>
        </header>

        <div className="flex gap-2">
          <Button href={`/plan${trip.start_date ? `?day=${trip.start_date}` : ""}`} variant="ink" full>Plan</Button>
          {isActive ? (
            <Button variant="secondary" full disabled>Active trip</Button>
          ) : (
            <form action={setActiveTrip} className="flex-1">
              <input type="hidden" name="tripId" value={trip.id} />
              <input type="hidden" name="back" value={`/trips/${trip.id}`} />
              <Button type="submit" variant="secondary" full>Set as active</Button>
            </form>
          )}
        </div>

        <SectionHeader title="Trip context" />
        <Card className="divide-y divide-line">
          <ListRow title="Local currency" trailing={<span className="text-[13px] font-bold">{trip.local_currency ?? "—"}</span>} />
          <ListRow title="Language" trailing={<span className="text-[13px] font-bold">{trip.local_language === "ja" ? "日本語" : (trip.local_language ?? "—")}</span>} />
          <ListRow title="Time zone" trailing={<span className="text-[13px] font-bold">{trip.local_tz ?? "—"}</span>} />
        </Card>

        <SectionHeader title="Stays" />
        <Card className="divide-y divide-line">
          {stays.length ? stays.map((s) => {
            const p = placeById(bundle, s.place_id);
            return p ? <ListRow key={s.id} href={`/plan/place/${p.id}`} leading={<IconCoin><HomeIcon size={20} /></IconCoin>} title={p.name} subtitle={`${formatDateRange(s.check_in?.slice(0, 10) ?? null, s.check_out?.slice(0, 10) ?? null)}${s.check_in ? ` · Check-in ${formatTime(new Date(s.check_in), trip.local_tz ?? user.profile.home_tz)}` : ""}`} chevron /> : null;
          }) : <ListRow title="No stay saved" subtitle="Add your hotel so 'Take me back to my hotel' works everywhere." />}
        </Card>

        <SectionHeader title={pluralize(travelers.length, "traveler")} />
        <Card className="divide-y divide-line">
          {travelers.map((t) => (
            <ListRow key={t.id} leading={<Tile name={t.name} size={36} radius={999} color={t.color} />} title={t.name} subtitle={t.user_id ? "Voya account" : "No account needed"} />
          ))}
          <ListRow leading={<IconCoin size={36}><Users size={18} /></IconCoin>} title="Add traveler" subtitle="Coming in the People round" />
        </Card>

        <SectionHeader title={pluralize(places.length, "saved place")} action={<Button href="/plan" variant="ghost" size="sm" className="h-auto min-h-0 px-1 text-[13px]">Open Plan</Button>} />
      </FadeIn>
    </Page>
  );
}
