import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import {
  dayStops, dayTimeline, formatDateRange, formatDistance, formatDuration, formatMoney, localDate, placeById, placeColor, routeDay,
  tripDayNumber, type DayStop, type TravelMode,
} from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { Map } from "@/components/map/Map";
import { DayRouteEditor } from "@/components/navigate/DayRouteEditor";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Chip, EmptyState } from "@/components/ui/primitives";
import { saveRoute } from "@/app/(app)/navigate/actions";
import { getActiveTrip, getTripBundle, now } from "@/lib/data";
import { routing } from "@/lib/routing";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Day route" };

const qs = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  route: z.uuid().optional(),
  mode: z.enum(["walk", "transit"]).default("walk"),
  /** comma-separated place ids — the user's reordering, kept in the URL so it survives reloads and is shareable */
  order: z.string().regex(/^[0-9a-f-]+(,[0-9a-f-]+)*$/).optional(),
});

/**
 * Multi-stop route: hotel → the day's places → hotel (or a saved route's stops).
 * Totals per the mockup (total time, walking distance, fares); reorder; save as a named route.
 */
export default async function DayRoutePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = qs.safeParse(await searchParams);
  if (!q.success) notFound();
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) notFound();
  const at = now();
  const tz = active.local_tz ?? user.profile.home_tz;
  const saved = q.data.route ? bundle.routes.find((r) => r.id === q.data.route) ?? null : null;
  if (q.data.route && !saved) notFound();
  const day = saved?.day ?? q.data.day ?? (tripDayNumber(active, localDate(at, tz)) ? localDate(at, tz) : active.start_date ?? localDate(at, tz));
  const mode: TravelMode = saved && (saved.mode === "walk" || saved.mode === "transit") ? saved.mode : q.data.mode;

  // Base stops: saved route's stops, else the day's plan.
  let stops: DayStop[] = saved
    ? bundle.routeStops.filter((s) => s.route_id === saved.id).sort((a, b) => a.sort_order - b.sort_order).flatMap((s) => {
        const p = placeById(bundle, s.place_id);
        if (!p || p.lat == null) return [];
        const isHotel = bundle.stays.some((st) => st.place_id === p.id);
        return [{ place: p, item: null, time: s.planned_time?.slice(0, 5) ?? null, color: isHotel ? categoryColors.stay : placeColor(bundle, p), isHotel }];
      })
    : dayStops(bundle, day);
  // Apply a URL reorder (only ids that are actually in the list; bookend hotels stay put).
  if (q.data.order && !saved) {
    const ids = q.data.order.split(",");
    const middle = stops.slice(1, -1);
    const reordered = ids.map((id) => middle.find((s) => s.place.id === id)).filter((s): s is DayStop => !!s);
    if (reordered.length === middle.length) stops = [stops[0]!, ...reordered, stops.at(-1)!];
  }
  if (stops.length < 2) {
    return <FadeIn className="p-4"><EmptyState title="Nothing to route yet" body="Add places to this day in Plan, then navigate it." action={<Button href={`/plan?day=${day}`} variant="secondary">Open Plan</Button>} /></FadeIn>;
  }

  const currency = active.local_currency ?? user.profile.home_currency;
  const plan = await routeDay(stops, routing, mode, currency);
  const rows = dayTimeline(plan);
  const pins = stops.map((s, i) => ({ id: `${s.place.id}-${i}`, lat: s.place.lat!, lng: s.place.lng!, label: s.isHotel ? (i === 0 ? "Hotel" : undefined) : s.place.name, color: s.color, dark: s.isHotel }));
  const path = plan.legs.flatMap((l) => l.route.geometry);
  const dayNo = tripDayNumber(active, day) ?? 1;
  const title = saved?.name ?? `Day ${dayNo} route`;

  return (
    <div className="flex flex-col lg:grid lg:h-dvh lg:grid-cols-[460px_1fr] lg:overflow-hidden">
      <FadeIn className="order-2 flex flex-col gap-3.5 px-4 pt-3.5 pb-6 md:px-7 lg:order-1 lg:overflow-y-auto lg:pt-7">
        <header className="flex items-center gap-2">
          <Button href="/navigate" variant="secondary" size="sm" aria-label="Back to Navigate" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-muted">{saved ? "Saved route" : "Multi-stop route"} · {formatDateRange(day, null)}</p>
            <h1 className="truncate text-[20px] font-extrabold tracking-[-0.02em]">{title}</h1>
          </div>
          {saved && <Chip>{saved.mode}</Chip>}
        </header>

        <div role="group" aria-label="Route totals">
          <dl className="grid grid-cols-3 gap-2">
            {[["Total", formatDuration(plan.totalSec, true)], ["On foot", formatDistance(plan.walkM)], ["Fares", plan.fares ? formatMoney(plan.fares.amount, plan.fares.currency) : "—"]].map(([k, v]) => (
              <div key={k} className="card px-3 py-2.5"><dt className="text-eyebrow">{k}</dt><dd className="text-[16px] font-extrabold">{v}</dd></div>
            ))}
          </dl>
        </div>

        <DayRouteEditor
          tripId={active.id}
          day={day}
          mode={mode}
          locked={!!saved}
          rows={rows.map((r) => ({ id: r.stop.place.id, name: r.stop.place.name, isHotel: r.stop.isHotel, color: r.stop.color, arrive: r.arrive, leave: r.leave, legSummary: r.leg ? `${formatDuration(r.leg.route.durationSec)} · ${formatDistance(r.leg.route.distanceM)}${r.leg.route.fare ? ` · ${formatMoney(r.leg.route.fare.amount, r.leg.route.fare.currency)}` : ""}` : null }))}
          saveAction={saveRoute}
          defaultName={saved?.name ?? `Day ${dayNo} · ${stops[1]?.place.name.split(" ")[0] ?? "route"}`}
        />
        {!saved && <Button href={`/navigate/tree?day=${day}`} variant="secondary" full>Split into groups (tree route)</Button>}
        <p className="text-[12px] text-muted">{plan.legs.some((l) => l.route.source === "mock") ? "Times are estimates; live transit arrives with a routing provider." : ""}</p>
      </FadeIn>

      <div className="relative order-1 h-[40dvh] min-h-[280px] lg:order-2 lg:h-full">
        <Map center={{ lat: 35.672, lng: 139.702 }} zoom={13} pins={pins} path={path} label={`Map of ${title}: ${stops.map((s) => s.place.name).join(" → ")}`} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-between">
          <span className="raised flex h-11 items-center rounded-lg px-4 text-[14px] font-bold">{title}</span>
          <span className="raised flex h-11 items-center rounded-lg px-4 text-[13px] font-bold text-muted">{formatDuration(plan.totalSec)}</span>
        </div>
      </div>
    </div>
  );
}
