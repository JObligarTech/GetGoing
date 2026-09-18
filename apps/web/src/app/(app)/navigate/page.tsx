import type { Metadata } from "next";
import { Home as HomeIcon, MapPinned, Route, Send, Utensils } from "lucide-react";
import { formatDateRange, localDate, navShortcuts, placeById, pluralize, tripDayNumber, MODE_LABEL } from "@voya/core";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Chip, EmptyState, IconCoin, ListRow, PageHeader, SectionHeader, Tile } from "@/components/ui/primitives";
import { getActiveTrip, getTripBundle, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Navigate" };

/** Navigate hub — contextual shortcuts ("Voya already knows") and the trip's saved routes. */
export default async function NavigatePage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) {
    return <Page><PageHeader eyebrow="Navigate" title="No active trip" /><EmptyState title="Create a trip first" body="Navigate uses the hotel and places saved on your trip." action={<Button href="/trips/new">Create a trip</Button>} /></Page>;
  }
  const at = now();
  const tz = active.local_tz ?? user.profile.home_tz;
  const today = localDate(at, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  const shortcuts = navShortcuts(bundle, day, hhmm);
  const icon = { hotel: <HomeIcon size={20} />, dinner: <Utensils size={20} />, next: <MapPinned size={20} /> };
  const dayNo = tripDayNumber(active, day) ?? 1;

  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <PageHeader eyebrow={active.name} title="Navigate" action={<Chip tone="premium">Atlas Premium Pass</Chip>} />

        <SectionHeader title="Shortcuts" />
        <Card className="divide-y divide-line">
          {shortcuts.map((s) => (
            <ListRow key={s.key} href={`/navigate/route?to=${s.place.id}`} leading={<IconCoin>{icon[s.key]}</IconCoin>} title={s.label} subtitle={s.detail} chevron ariaLabel={`${s.label}: ${s.place.name}`} />
          ))}
          <ListRow href={`/navigate/day?day=${day}`} leading={<IconCoin><Route size={20} /></IconCoin>} title="Navigate the day" subtitle={`Day ${dayNo} · hotel → ${pluralize(bundle.itinerary.filter((i) => i.day === day && i.place_id).length, "stop")} → hotel`} chevron />
          <ListRow leading={<IconCoin><Send size={20} /></IconCoin>} title="Send my location" subtitle={`to ${bundle.travelers.filter((t) => t.user_id !== user.id).map((t) => t.name).join(", ") || "your travelers"}`} trailing={<Chip tone="plain">Next round</Chip>} />
        </Card>

        <SectionHeader title="Saved routes" />
        {bundle.routes.length ? (
          <Card className="divide-y divide-line">
            {bundle.routes.map((r) => {
              const stops = bundle.routeStops.filter((s) => s.route_id === r.id);
              const first = placeById(bundle, stops[0]?.place_id ?? null), last = placeById(bundle, stops.at(-1)?.place_id ?? null);
              return (
                <ListRow
                  key={r.id}
                  href={`/navigate/day?route=${r.id}`}
                  leading={<Tile name={r.name} size={44} radius={12} invert />}
                  title={r.name}
                  subtitle={`${pluralize(stops.length, "stop")} · ${MODE_LABEL[r.mode]}${first && last && first.id !== last.id ? ` · ${first.name.split(" ")[0]} → ${last.name.split(" ")[0]}` : ""}`}
                  trailing={r.day ? <Chip tone="plain">{formatDateRange(r.day, null)}</Chip> : undefined}
                  chevron
                />
              );
            })}
          </Card>
        ) : (
          <EmptyState title="No saved routes yet" body="Navigate a day and save it, or build a route from any place." />
        )}
      </FadeIn>
    </Page>
  );
}
