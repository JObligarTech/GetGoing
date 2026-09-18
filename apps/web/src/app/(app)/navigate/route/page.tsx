import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { compareModes, formatDistance, formatDuration, formatMoney, formatTime, localDate, navShortcuts, placeById, placeColor, stayForDate, tripDayNumber, type TravelMode } from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { Map } from "@/components/map/Map";
import { ModePicker } from "@/components/navigate/ModePicker";
import { ShareEta } from "@/components/navigate/ShareEta";
import { StepIcon } from "@/components/navigate/StepIcon";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Chip, Dot, ListRow, SectionHeader } from "@/components/ui/primitives";
import { getActiveTrip, getTripBundle, now } from "@/lib/data";
import { routing } from "@/lib/routing";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Directions" };

const qs = z.object({ to: z.uuid(), from: z.uuid().or(z.literal("current")).default("current"), mode: z.enum(["walk", "transit", "drive", "cycle"]).default("transit") });

/**
 * Directions: FROM (current location = the hotel until device location arrives in the
 * mobile round) → TO, compared across modes, steps listed, drawn on the map.
 * Phone: map full-bleed with the turn card + ETA sheet over it; desktop: steps left, map right.
 */
export default async function RoutePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = qs.safeParse(await searchParams);
  if (!q.success) notFound();
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) notFound();
  const at = now();
  const tz = active.local_tz ?? user.profile.home_tz;
  const today = localDate(at, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;

  const to = placeById(bundle, q.data.to);
  const stay = stayForDate(bundle.stays, day);
  const hotel = stay ? placeById(bundle, stay.place_id) : null;
  const from = q.data.from === "current" ? hotel : placeById(bundle, q.data.from);
  if (!to || !from || to.lat == null || to.lng == null || from.lat == null || from.lng == null) notFound();

  const currency = active.local_currency ?? user.profile.home_currency;
  const results = await compareModes({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }, routing, currency);
  const mode: TravelMode = results[q.data.mode] ? q.data.mode : (Object.keys(results).find((m) => results[m as TravelMode]) as TravelMode);
  const r = results[mode]!;
  const arrive = new Date(at.getTime() + r.durationSec * 1000);
  const toColor = placeColor(bundle, to);
  const pins = [
    { id: from.id, lat: from.lat, lng: from.lng, label: from.name, color: from.id === hotel?.id ? categoryColors.stay : placeColor(bundle, from), dark: from.id === hotel?.id },
    { id: to.id, lat: to.lat, lng: to.lng, label: to.name, color: toColor },
  ];
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  const shortcuts = navShortcuts(bundle, day, hhmm).filter((s) => s.place.id !== to.id && s.place.id !== from.id);
  const firstStep = r.steps[0];
  const summary = `${formatDuration(r.durationSec)} · ${formatDistance(r.distanceM)}${r.fare ? ` · ${formatMoney(r.fare.amount, r.fare.currency)}` : ""}${r.transfers ? ` · ${r.transfers} transfer${r.transfers > 1 ? "s" : ""}` : ""}`;

  const steps = (
    <Card role="list" aria-label="Directions steps" className="divide-y divide-line">
      {r.steps.map((s, i) => (
        <div role="listitem" key={i}>
          <ListRow leading={<StepIcon kind={s.kind} />} title={s.instruction} subtitle={[s.durationSec ? formatDuration(s.durationSec) : null, s.distanceM ? formatDistance(s.distanceM) : null, s.detail].filter(Boolean).join(" · ")} />
        </div>
      ))}
    </Card>
  );

  const sheet = (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <p><span className="text-[26px] font-extrabold tracking-[-0.02em]">{formatDuration(r.durationSec)}</span><span className="ml-2 text-[13px] text-muted">arrive {formatTime(arrive, tz)}</span></p>
        {r.fare && <span className="text-[15px] font-bold">{formatMoney(r.fare.amount, r.fare.currency)}</span>}
      </div>
      <ModePicker results={results} current={mode} to={to.id} from={q.data.from} />
      <p className="text-[12px] text-muted">{summary}{r.source === "mock" ? " · estimated" : ""}</p>
      <div className="flex gap-2">
        <ShareEta text={`${user.profile.display_name.split(" ")[0]} arrives at ${to.name} around ${formatTime(arrive, tz)} (${formatDuration(r.durationSec)} by ${mode}).`} />
        <Button href="/navigate" variant="secondary" full>End</Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[460px_1fr] lg:overflow-hidden">
      {/* Left column (desktop) / bottom sheet (phone) */}
      <FadeIn className="order-2 flex flex-col gap-3.5 px-4 pt-3.5 pb-6 md:px-7 lg:order-1 lg:overflow-y-auto lg:pt-7">
        <header className="flex items-center gap-2">
          <Button href="/navigate" variant="secondary" size="sm" aria-label="Back to Navigate" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-muted">Leaving now · {from.id === hotel?.id ? "from your hotel" : `from ${from.name}`}</p>
            <h1 className="flex items-center gap-2 truncate text-[20px] font-extrabold tracking-[-0.02em]"><Dot color={toColor} size={8} />To {to.name}</h1>
          </div>
        </header>
        {sheet}
        <SectionHeader title="Steps" />
        {steps}
        {shortcuts.length > 0 && (
          <>
            <SectionHeader title="Instead" />
            <div className="flex flex-wrap gap-2">
              {shortcuts.map((s) => <Button key={s.key} href={`/navigate/route?to=${s.place.id}&mode=${mode}`} variant="secondary" size="sm">{s.label}</Button>)}
              {to.local_address && <Button href={`/plan/place/${to.id}`} variant="secondary" size="sm">Show address in {active.local_language === "ja" ? "日本語" : "local language"}</Button>}
            </div>
          </>
        )}
      </FadeIn>

      {/* Map with the turn card (phone) */}
      <div className="relative order-1 h-[46dvh] min-h-[320px] lg:order-2 lg:h-full">
        <Map center={{ lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 }} zoom={13.6} pins={pins} path={r.geometry} label={`Map of the ${mode} route from ${from.name} to ${to.name}, ${summary}`} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-end lg:justify-start">
          <span className="raised flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-bold"><Dot color={toColor} size={8} />To {to.name}</span>
        </div>
        {firstStep && (
          <div className="absolute inset-x-4 bottom-4 lg:hidden">
            <div className="raised flex items-center gap-3 rounded-2xl px-4 py-3.5" role="status" aria-label={`Next: ${firstStep.instruction}`}>
              <StepIcon kind={firstStep.kind} filled />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-extrabold">{firstStep.instruction}</p>
                <p className="text-[12.5px] text-muted">{[firstStep.distanceM ? formatDistance(firstStep.distanceM) : null, r.steps[1]?.instruction ? `then ${r.steps[1].instruction.toLowerCase()}` : null].filter(Boolean).join(" · ")}</p>
              </div>
              <Chip>{formatDuration(r.durationSec)}</Chip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
