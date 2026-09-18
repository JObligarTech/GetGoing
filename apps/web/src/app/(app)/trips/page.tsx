import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { boundsOf, deriveStatus, formatDateRange, pluralize, tripPhaseLabel } from "@voya/core";
import { Map } from "@/components/map/Map";
import { previewSegments } from "@/components/trips/itinerary";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Chip, EmptyState, ListRow, PageHeader, SectionHeader, Tile } from "@/components/ui/primitives";
import { getActiveTrip, getTripBundle, getTrips, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Trips" };

/** Trips list + active-trip preview. One map: a 140px strip on phones, the full right pane on desktop. */
export default async function TripsPage() {
  const user = await requireUser();
  const [trips, active] = await Promise.all([getTrips(), getActiveTrip(user.profile.home_tz)]);
  const at = now();
  const bundle = active ? await getTripBundle(active.id) : null;
  const pins = (bundle?.places ?? [])
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: bundle!.stays.some((s) => s.place_id === p.id) ? "#7DBA8E" : "#E0703A" }));
  const b = boundsOf(pins);
  const col = "lg:col-start-1 lg:w-[460px]";

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[460px_1fr] lg:grid-rows-[auto_auto_1fr] lg:overflow-hidden">
      <FadeIn className={`flex flex-col gap-3.5 px-4 pt-4 md:px-7 md:pt-7 ${col}`}>
        <PageHeader eyebrow={user.profile.display_name.split(" ")[0]} title="Trips" action={<Button href="/trips/new" variant="ink" icon={<Plus size={18} strokeWidth={2.4} />} aria-label="New trip"><span className="hidden md:inline">New trip</span></Button>} />
        {trips.length ? (
          <Card className="divide-y divide-line">
            {trips.map((t) => {
              const isActive = t.id === active?.id;
              const status = deriveStatus(t, at, t.local_tz ?? user.profile.home_tz);
              const chip = status === "draft" ? "Draft" : status === "past" ? "Past" : tripPhaseLabel(t, at, t.local_tz ?? undefined);
              return (
                <ListRow
                  key={t.id}
                  href={`/trips/${t.id}`}
                  active={isActive}
                  leading={<Tile name={t.name} invert={!isActive} />}
                  title={status === "draft" ? `${t.name} · draft` : t.name}
                  subtitle={`${formatDateRange(t.start_date, t.end_date)} · ${pluralize(t.traveler_count, "traveler")} · ${pluralize(t.place_count, "place")}`}
                  trailing={<Chip tone={status === "upcoming" || status === "active" ? "tint" : "plain"}>{chip}</Chip>}
                  ariaLabel={`${t.name}, ${formatDateRange(t.start_date, t.end_date)}, ${chip}${isActive ? ", active trip" : ""}`}
                />
              );
            })}
          </Card>
        ) : (
          <EmptyState title="No trips yet" body="Create one to give every tool its context." action={<Button href="/trips/new">Create a trip</Button>} />
        )}
        {active && <SectionHeader title={`${active.name} · preview`} />}
      </FadeIn>

      {active && (
        <>
          <div className="px-4 pt-3.5 md:px-7 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:h-full lg:p-0">
            <div className="h-[140px] overflow-hidden rounded-2xl border border-line lg:h-full lg:rounded-none lg:border-0 lg:border-l">
              <Map center={b?.center ?? { lat: 35.68, lng: 139.75 }} zoom={b ? Math.max(9, 11.5 - b.span * 10) : 10.5} pins={pins} static label={`Map of ${active.name} with ${pins.length} saved places`} />
            </div>
          </div>
          <FadeIn delay={0.05} className={`px-4 pt-3.5 pb-6 md:px-7 ${col} lg:overflow-y-auto`}>
            <Card className="divide-y divide-line">
              {previewSegments(active).map((s) => (
                <div key={s.label + s.city} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="w-16 shrink-0 text-[12px] font-bold text-muted">{s.label}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{s.city}</span><span className="block truncate text-[12px] text-muted">{s.detail}</span></span>
                </div>
              ))}
            </Card>
          </FadeIn>
        </>
      )}
    </div>
  );
}
