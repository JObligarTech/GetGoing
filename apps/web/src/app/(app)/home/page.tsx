import type { Metadata } from "next";
import { Bell, Compass, Landmark, Languages, Home as HomeIcon, Receipt } from "lucide-react";
import {
  boundsOf, categoriesForPlace, dayPins, formatClock, formatDateRange, formatTime, greeting, itemsForDay, localDate, placeById, placeColor,
  stayForDate, tripDayNumber, tripPhaseLabel,
} from "@voya/core";
import { Map } from "@/components/map/Map";
import { Clock } from "@/components/home/Clock";
import { Page } from "@/components/shell/Page";
import { TripSwitcher } from "@/components/trips/TripSwitcher";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Chip, Dot, EmptyState, IconButton, IconCoin, ListRow, SectionHeader } from "@/components/ui/primitives";
import { setActiveTrip } from "@/app/(app)/actions";
import { getActiveTrip, getTripBundle, getTrips, now } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

/**
 * Home. Phone: header → map card → today's list (per the iPhone mockup).
 * Desktop: the same DOM re-flows into a 460px column + full-height map via CSS grid,
 * so there is exactly one map instance and one accessibility tree.
 */
export default async function HomePage() {
  const user = await requireUser();
  const [trips, active] = await Promise.all([getTrips(), getActiveTrip(user.profile.home_tz)]);
  const at = now();
  const homeTz = user.profile.home_tz;
  const hello = `${greeting(at, active?.local_tz ?? homeTz)}, ${user.profile.display_name.split(" ")[0]}`;

  if (!active) {
    return (
      <Page>
        <header><p className="text-[13px] font-medium text-muted">{hello}</p><h1 className="text-[26px] font-extrabold tracking-[-0.02em]">No trips yet</h1></header>
        <EmptyState title="Start with a trip" body="Voya remembers the trip so you don't have to. Add one and every tool picks up its currency, language and places." action={<Button href="/trips/new">Create a trip</Button>} />
      </Page>
    );
  }

  const bundle = await getTripBundle(active.id);
  const tz = active.local_tz ?? homeTz;
  // "Today" on the trip = trip day if we're inside the dates, otherwise Day 1.
  const today = localDate(at, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const items = bundle ? itemsForDay(bundle, day) : [];
  const scheduled = items.filter((i) => i.place_id);
  const stay = bundle ? stayForDate(bundle.stays, day) : null;
  const hotel = stay && bundle ? placeById(bundle, stay.place_id) : null;
  const pins = bundle ? dayPins(bundle, day) : [];
  // Frame every pin of the day (hotel + places); fall back to the hotel, then the city.
  const bounds = boundsOf(pins.length ? pins : hotel?.lat != null ? [{ lat: hotel.lat, lng: hotel.lng! }] : []);
  const center = bounds?.center ?? { lat: 35.6885, lng: 139.702 };
  const zoom = bounds ? Math.max(11.5, Math.min(14, Math.log2(360 / Math.max(bounds.span, 0.001)) - 1.6)) : 13.25;
  const phase = tripPhaseLabel(active, at, tz);
  const city = active.cities[0] ?? active.name;
  const dayLabel = formatDateRange(day, null);
  const firstPlace = scheduled.map((i) => placeById(bundle!, i.place_id)).find(Boolean);
  const col = "lg:col-start-1 lg:w-[460px] lg:px-7";

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[460px_1fr] lg:grid-rows-[auto_auto_auto_1fr_auto] lg:overflow-hidden">
      {/* Header */}
      <FadeIn className={`px-4 pt-4 pb-3.5 md:px-7 md:pt-7 ${col}`}>
        <header className="flex min-h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">{hello}</p>
            <h1 className="sr-only">Home · {active.name}</h1>
            <TripSwitcher trips={trips} activeId={active.id} action={setActiveTrip} back="/home" />
          </div>
          <IconButton label="Notifications"><Bell size={20} /></IconButton>
        </header>
      </FadeIn>

      {/* Map card — column 2, spanning every row on desktop */}
      <div className="px-4 md:px-7 lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:h-full lg:px-0">
        <div className="relative h-[300px] overflow-hidden rounded-3xl border border-line bg-tint lg:h-full lg:rounded-none lg:border-0 lg:border-l">
          <Map center={center} zoom={zoom} pins={pins} static label={`Map of ${city} with ${pins.length} pins: ${pins.map((p) => p.label).join(", ")}`} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between">
            <span className="raised flex h-[30px] items-center gap-2 rounded-sm px-2.5 text-[12px] font-bold"><Dot color="var(--c-primary)" size={8} />{phase}</span>
            <Clock city={city} tz={tz} homeTz={homeTz} initialNow={at.toISOString()} frozen={isDemo} />
          </div>
          {hotel && (
            <div className="absolute inset-x-3 bottom-3">
              <ListRow
                href={`/plan/place/${hotel.id}`}
                className="raised rounded-xl px-3 py-2.5"
                leading={<IconCoin><HomeIcon size={20} /></IconCoin>}
                title={hotel.name}
                subtitle={`${formatDateRange(stay!.check_in?.slice(0, 10) ?? null, stay!.check_out?.slice(0, 10) ?? null)}${stay!.check_in ? ` · Check-in ${formatTime(new Date(stay!.check_in), tz)}` : ""}`}
                trailing={<Chip>{active.traveler_count} travelers</Chip>}
                ariaLabel={`Your stay: ${hotel.name}. Open details`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Saved for today */}
      <FadeIn delay={0.05} className={`flex flex-col gap-2 px-4 pt-3.5 md:px-7 ${col} lg:overflow-y-auto`}>
        <SectionHeader title={`Saved for ${dayLabel}`} action={<Button href="/plan" variant="ghost" size="sm" className="h-auto min-h-0 px-1 text-[13px]">All {active.place_count} places</Button>} />
        {scheduled.length ? (
          <Card className="divide-y divide-line">
            {scheduled.map((i) => {
              const p = placeById(bundle!, i.place_id)!;
              const cat = categoriesForPlace(bundle!, p.id)[0]?.name ?? (p.priority === "must" ? "Must visit" : "Saved");
              return <ListRow key={i.id} href={`/plan/place/${p.id}`} leading={<Dot color={placeColor(bundle!, p)} />} title={p.name} subtitle={[cat, formatClock(i.start_time), i.note].filter(Boolean).join(" · ")} chevron />;
            })}
          </Card>
        ) : (
          <EmptyState title="Nothing planned for this day yet" body="Save places in Plan and drop them into the day." action={<Button href="/plan" variant="secondary" size="sm">Open Plan</Button>} />
        )}
      </FadeIn>

      {/* Tools (desktop only — phones reach them from the Tools tab) */}
      <FadeIn delay={0.1} className={`hidden grid-cols-2 gap-2.5 px-4 pt-3.5 md:px-7 lg:grid ${col}`} role="group" aria-label="Tools">
        {[
          { href: "/translate", Icon: Languages, t: "Translate", s: `${active.local_language === "ja" ? "日本語" : (active.local_language ?? "Language")} ready` },
          { href: "/currency", Icon: Landmark, t: "Currency", s: active.local_currency ? `${user.profile.home_currency} ⇄ ${active.local_currency}` : "Set a trip currency" },
          { href: "/split", Icon: Receipt, t: "Split", s: "No open bills" },
          { href: "/navigate", Icon: Compass, t: "Navigate", s: "Routes from your places" },
        ].map(({ href, Icon, t, s }) => (
          <a key={href} href={href} className="card flex flex-col gap-2 p-3 transition-colors hover:bg-tint/60">
            <IconCoin size={36}><Icon size={18} /></IconCoin>
            <span><span className="block text-[14px] font-bold">{t}</span><span className="block text-[12px] text-muted">{s}</span></span>
          </a>
        ))}
      </FadeIn>

      {/* Desktop CTAs pinned to the bottom of the column */}
      <div className={`hidden gap-2 px-4 pt-3.5 pb-6 md:px-7 lg:flex ${col} lg:row-start-5 lg:self-end`}>
        <Button href={firstPlace ? `/navigate/route?to=${firstPlace.id}` : "/navigate"} variant="ink" full>{firstPlace ? `Navigate to ${firstPlace.name.split(" ")[0]}` : "Navigate"}</Button>
        <Button href={`/plan?day=${day}`} variant="secondary" full>Plan Day {tripDayNumber(active, day) ?? 1}</Button>
      </div>
      <div className="h-6 lg:hidden" />
    </div>
  );
}
