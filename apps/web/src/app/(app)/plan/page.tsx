import type { Metadata } from "next";
import { z } from "zod";
import {
  boundsOf, categoriesForPlace, dayPins, formatClock, formatDayHeading, itemsForDay, placeById, placeColor,
  suggestionsForSlot, tripDates, tripDayNumber, unscheduledPlaces,
} from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { Map } from "@/components/map/Map";
import { DayPicker } from "@/components/plan/DayPicker";
import { OpenSlot } from "@/components/plan/SlotSuggestions";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Dot, EmptyState, Hint, ListRow } from "@/components/ui/primitives";
import { assignPlaceToSlot } from "@/app/(app)/actions";
import { getActiveTrip, getTripBundle } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plan" };

const qs = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), view: z.enum(["day", "map"]).default("day") });

export default async function PlanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const q = qs.parse(await searchParams);
  const active = await getActiveTrip(user.profile.home_tz);
  if (!active) return <Page><EmptyState title="No active trip" body="Create a trip to start planning." action={<Button href="/trips/new">Create a trip</Button>} /></Page>;
  const bundle = await getTripBundle(active.id);
  if (!bundle) return <Page><EmptyState title="Trip not found" /></Page>;

  const dates = tripDates(bundle.trip);
  const day = q.day && dates.includes(q.day) ? q.day : dates[0] ?? q.day ?? "2027-01-01";
  const dayNo = tripDayNumber(bundle.trip, day) ?? 1;
  const items = itemsForDay(bundle, day);
  const pins = dayPins(bundle, day);
  const unscheduled = unscheduledPlaces(bundle);
  const b = boundsOf(pins);
  const suggestionsFor = (i: number) =>
    suggestionsForSlot(bundle, day, i).map((s) => ({ ...s, color: placeColor(bundle, s.place), category: categoriesForPlace(bundle, s.place.id)[0]?.name ?? "Saved" }));
  const hhmm = (t: string | null) => (t ? t.replace(/^0/, "") : "—");
  const openSlots = items.filter((i) => !i.place_id).length;
  const nearby = openSlots ? suggestionsFor(items.findIndex((i) => !i.place_id)).length : 0;

  const timeline = (
    <FadeIn className="flex flex-col gap-3.5">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted">{bundle.trip.name} · Day {dayNo}</p>
          <h1 className="truncate text-[26px] font-extrabold tracking-[-0.02em]">{formatDayHeading(day)}</h1>
        </div>
        {dates.length > 1 && <DayPicker dates={dates} current={day} view={q.view} />}
      </header>

      {items.length ? (
        <Card className="divide-y divide-line" role="list" aria-label={`Day ${dayNo} timeline`}>
          {items.map((item, i) => {
            const p = placeById(bundle, item.place_id);
            if (!p) {
              return (
                <div role="listitem" key={item.id}>
                  <OpenSlot time={hhmm(item.start_time)} title={item.title ?? "Open slot"} suggestions={suggestionsFor(i)} tripId={bundle.trip.id} itemId={item.id} day={day} action={assignPlaceToSlot} />
                </div>
              );
            }
            const cat = categoriesForPlace(bundle, p.id)[0]?.name ?? (p.priority === "must" ? "Must visit" : "Saved");
            return (
              <div role="listitem" key={item.id}>
                <ListRow
                  href={`/plan/place/${p.id}`}
                  leading={<><span className="w-11 shrink-0 text-[12.5px] font-bold text-muted">{hhmm(item.start_time)}</span><Dot color={placeColor(bundle, p)} /></>}
                  title={p.name}
                  subtitle={[cat, item.note].filter(Boolean).join(" · ")}
                  ariaLabel={`${formatClock(item.start_time)}, ${p.name}, ${cat}${item.note ? `, ${item.note}` : ""}`}
                />
              </div>
            );
          })}
        </Card>
      ) : (
        <EmptyState title={`Nothing on Day ${dayNo} yet`} body={`${unscheduled.length} saved places are waiting. Pick from the map.`} />
      )}

      {openSlots > 0 && <Hint>Tap the open slot to pick from {nearby} saved {nearby === 1 ? "place" : "places"} nearby.</Hint>}

      <div className="mt-auto flex gap-2 pt-2 lg:hidden">
        <Button href={`/navigate/day?day=${day}`} variant="ink" size="cta" full>Navigate the day</Button>
        <Button href={`/plan?day=${day}&view=${q.view === "map" ? "day" : "map"}`} variant="secondary" size="cta" full>{q.view === "map" ? "List" : "Map"}</Button>
      </div>
    </FadeIn>
  );

  const suggestion = openSlots ? suggestionsFor(items.findIndex((i) => !i.place_id))[0] : undefined;
  const mapPane = (
    <div className="relative h-full min-h-[calc(100dvh-84px)] lg:min-h-0">
      <Map
        center={b?.center ?? { lat: 35.672, lng: 139.702 }}
        zoom={b ? Math.min(14, 13.4 - b.span * 8) : 13.4}
        pins={[...pins, ...unscheduled.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: categoryColors.unscheduled }))]}
        label={`Map of Day ${dayNo}: ${pins.map((p) => p.label).join(", ")}${unscheduled.length ? `, plus ${unscheduled.length} unscheduled places` : ""}`}
        className="absolute inset-0"
      />
      <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-between">
        <span className="raised flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-bold">{bundle.trip.name} · Day {dayNo}</span>
        <span className="raised flex h-11 items-center gap-2 rounded-lg px-4 text-[13px] font-bold text-muted"><Dot color={categoryColors.unscheduled} />{unscheduled.length} unscheduled</span>
      </div>
      {suggestion && (
        <div className="absolute inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] lg:bottom-4">
          <ListRow
            href={`/plan/place/${suggestion.place.id}`}
            className="raised rounded-2xl px-4 py-3.5"
            leading={<Dot color={suggestion.color} />}
            title={suggestion.place.name}
            subtitle={`${suggestion.category} · ${suggestion.minutes} min from ${suggestion.fromName} · fits the ${formatClock(items.find((i) => !i.place_id)?.start_time ?? null)} slot`}
            chevron
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="lg:flex lg:h-dvh lg:overflow-hidden">
      <Page className={q.view === "map" ? "hidden lg:flex lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line" : "min-h-[calc(100dvh-84px)] lg:min-h-0 lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line"}>
        {timeline}
      </Page>
      <div className={q.view === "map" ? "min-w-0 flex-1" : "hidden min-w-0 flex-1 lg:block"}>{mapPane}</div>
      {q.view === "map" && (
        <div className="fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-10 flex justify-center lg:hidden">
          <Button href={`/plan?day=${day}&view=day`} variant="ink" size="md">Back to list</Button>
        </div>
      )}
    </div>
  );
}
