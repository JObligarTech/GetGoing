import type { EntitlementRow, Json, PassGiftRow, PassKind, PassMarkRow, TravelerRow, TripRow } from "./db/database.types";
import type { TripBundle } from "./domain";
import { formatDateRange } from "./format";
import { localDate } from "./selectors";

// ─── Plans ───────────────────────────────────────────────────────────────────
export type PassPlanId = "trip" | "monthly" | "yearly";
export interface PassPlan { id: PassPlanId; label: string; price: number; period: string; renews: boolean; save?: string }

export const PASS_PLANS: readonly PassPlan[] = [
  { id: "trip", label: "Single trip", price: 2.99, period: "one time", renews: false },
  { id: "monthly", label: "Monthly", price: 4.99, period: "/ month", renews: true },
  { id: "yearly", label: "Yearly", price: 49.99, period: "/ year", renews: true, save: "Save 17%" },
];
export const PASS_PRICES = { trip: { label: "Single trip", price: 2.99, note: "up to 14 days" }, monthly: { label: "Monthly", price: 4.99, note: "renews" }, yearly: { label: "Yearly", price: 49.99, note: "renews" } } as const;
export const GIFT_DAYS = 3;
export const GIFT_CODE_TTL_DAYS = 30;
export const EXTENSION_PRICE = 0.99;
export const EXTENSION_MAX_DAYS = 7;
export const TRIP_PASS_NIGHTS = 14;

export function planById(id: string): PassPlan | null {
  return PASS_PLANS.find((p) => p.id === id) ?? null;
}

export function planBlurb(plan: PassPlanId, trip: Pick<TripRow, "start_date" | "end_date"> | null): string {
  if (plan === "trip") return `Up to ${TRIP_PASS_NIGHTS} days${trip?.start_date ? `, ${formatDateRange(trip.start_date, trip.end_date)}` : ""}. One-time, no renewal.`;
  if (plan === "monthly") return `Every trip. Gift a friend ${GIFT_DAYS} days per trip. Cancel anytime.`;
  return `Everything in Monthly. $${(49.99 / 12).toFixed(2)} a month, billed once.`;
}

// ─── Zoned time ──────────────────────────────────────────────────────────────
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a local calendar day starts (00:00 in `tz`). */
export function zonedMidnight(date: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  let at = new Date(guess - tzOffsetMs(new Date(guess), tz));
  const off = tzOffsetMs(at, tz);
  if (guess - off !== at.getTime()) at = new Date(guess - off);
  return at;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Midnight (local, in `tz`) at the end of the local day `days` after `at`'s local day. `days = 0` → tonight. */
export function midnightAfter(at: Date, tz: string, days: number): Date {
  return zonedMidnight(addDays(localDate(at, tz), days + 1), tz);
}

function addMonths(at: Date, months: number): Date {
  const d = new Date(at.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// ─── Windows ─────────────────────────────────────────────────────────────────
/**
 * When a purchased pass starts and ends. A single-trip pass covers the trip's dates up to
 * 14 nights from its first day (or 14 days from now when the trip is undated); monthly and
 * yearly run from now. Mirrors `grant_pass` in migration 0800.
 */
export function passWindow(plan: PassPlanId, now: Date, trip: Pick<TripRow, "start_date" | "end_date" | "local_tz"> | null, tz: string): { startsAt: Date; endsAt: Date } {
  if (plan === "monthly") return { startsAt: now, endsAt: addMonths(now, 1) };
  if (plan === "yearly") return { startsAt: now, endsAt: addMonths(now, 12) };
  const zone = trip?.local_tz ?? tz;
  if (trip?.start_date) {
    const first = zonedMidnight(trip.start_date, zone);
    const cap = zonedMidnight(addDays(trip.start_date, TRIP_PASS_NIGHTS + 1), zone);
    const tripEnd = trip.end_date ? zonedMidnight(addDays(trip.end_date, 1), zone) : cap;
    const endsAt = new Date(Math.min(cap.getTime(), tripEnd.getTime()));
    return { startsAt: new Date(Math.min(now.getTime(), first.getTime())), endsAt: endsAt.getTime() > now.getTime() ? endsAt : midnightAfter(now, zone, TRIP_PASS_NIGHTS) };
  }
  return { startsAt: now, endsAt: midnightAfter(now, zone, TRIP_PASS_NIGHTS) };
}

/** A gift accepted at `acceptedAt` ends at midnight (trip time) `days` days later — "3 days later · midnight Tokyo". */
export function giftEndsAt(acceptedAt: Date, tz: string, days = GIFT_DAYS): Date {
  return midnightAfter(acceptedAt, tz, days);
}

/** An extension continues from the gift's end for whole local days. */
export function extensionEndsAt(giftEnd: Date, tz: string, days: number): Date {
  return midnightAfter(new Date(giftEnd.getTime() - 60_000), tz, days);
}

// ─── Entitlements ────────────────────────────────────────────────────────────
/** The entitlement that unlocks the pass features for this trip right now, if any. */
export function activePass(entitlements: EntitlementRow[], tripId: string | null, now: Date): EntitlementRow | null {
  const t = now.getTime();
  return entitlements
    .filter((e) => new Date(e.starts_at).getTime() <= t && new Date(e.ends_at).getTime() > t && (e.trip_id == null || e.trip_id === tripId))
    .sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0] ?? null;
}

/** A pass that has ended on this trip (and nothing active) — "Atlas Premium Pass ended". */
export function endedPass(entitlements: EntitlementRow[], tripId: string | null, now: Date): EntitlementRow | null {
  if (activePass(entitlements, tripId, now)) return null;
  const t = now.getTime();
  return entitlements.filter((e) => new Date(e.ends_at).getTime() <= t && (e.trip_id == null || e.trip_id === tripId)).sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0] ?? null;
}

export function kindLabel(kind: PassKind): string {
  return kind === "gift" ? "Gifted" : kind === "extension" ? "Extended" : kind === "trip" ? "Single trip" : kind === "monthly" ? "Monthly" : "Yearly";
}

export function daysLeft(e: Pick<EntitlementRow, "ends_at">, now: Date): number {
  return Math.max(0, Math.ceil((new Date(e.ends_at).getTime() - now.getTime()) / 86_400_000));
}

export function passLabel(e: EntitlementRow, now: Date): string {
  const days = daysLeft(e, now);
  return `${kindLabel(e.kind)} · ${days === 1 ? "1 day" : `${days} days`} left`;
}

/** How a holder shows up on avatars and chips: the amber mark, ring-only for gifted access, or nothing. */
export type PassMark = "pass" | "gifted" | null;
export function markFor(e: Pick<EntitlementRow, "kind"> | null | undefined): PassMark {
  if (!e) return null;
  return e.kind === "gift" || e.kind === "extension" ? "gifted" : "pass";
}
export function markForUser(marks: PassMarkRow[], userId: string | null | undefined): PassMark {
  if (!userId) return null;
  return markFor(marks.find((m) => m.user_id === userId));
}

/** Passes end at midnight; people read the day before as the last covered day. */
const lastMinute = (at: Date) => new Date(at.getTime() - 60_000);
const dateFmt = (at: Date, tz: string, weekday = false) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...(weekday ? { weekday: "short" } : {}), month: "short", day: "numeric", year: weekday ? undefined : "numeric" }).format(at);

/** "Tue, Mar 18 · 11:59 PM JST" for a pass that ends at midnight. */
export function formatEnds(endsAt: Date, tz: string): string {
  const shown = new Date(endsAt.getTime() - 60_000);
  const day = dateFmt(shown, tz, true);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(shown);
  return `${day} · ${time}`;
}

/** Profile row copy: "Atlas Premium Pass · yearly" + "Renews Sep 1, 2027". */
export function passSummary(e: EntitlementRow | null, now: Date, tz: string): { title: string; detail: string } {
  if (!e) return { title: "Atlas Premium Pass", detail: "Upgrade" };
  const kind = e.kind === "gift" || e.kind === "extension" ? "gifted" : e.kind;
  const ends = new Date(e.ends_at);
  const renews = e.kind === "monthly" || e.kind === "yearly";
  return { title: `Atlas Premium Pass · ${kind}`, detail: renews ? `Renews ${dateFmt(ends, tz)}` : e.kind === "trip" ? `Ends ${dateFmt(lastMinute(ends), tz)}` : `${passLabel(e, now)} · ends ${formatEnds(ends, tz)}` };
}

export interface CheckoutSummary { plan: PassPlan; startsAt: Date; endsAt: Date; blurb: string; afterPay: string }
/** What the buyer is agreeing to, computed once for the checkout and the confirmation. */
export function checkoutSummary(planId: PassPlanId, trip: Pick<TripRow, "name" | "start_date" | "end_date" | "local_tz"> | null, now: Date, tz: string): CheckoutSummary | null {
  const plan = planById(planId);
  if (!plan) return null;
  const { startsAt, endsAt } = passWindow(planId, now, trip, tz);
  const afterPay = plan.renews ? `${plan.label} · renews ${dateFmt(endsAt, tz)}.` : `${plan.label}${trip ? ` · ${trip.name}` : ""} · ends ${dateFmt(lastMinute(endsAt), tz)}.`;
  return { plan, startsAt, endsAt, blurb: planBlurb(planId, trip), afterPay };
}

// ─── Gifting ─────────────────────────────────────────────────────────────────
/** Members on Monthly or Yearly can gift one traveler per trip 3 days. */
export function canGift(entitlements: EntitlementRow[], tripId: string, gifts: PassGiftRow[], userId: string, now: Date): { ok: true } | { ok: false; reason: string } {
  const pass = activePass(entitlements, tripId, now);
  if (!pass || (pass.kind !== "monthly" && pass.kind !== "yearly")) return { ok: false, reason: "Gifting comes with the Monthly and Yearly pass." };
  if (gifts.some((g) => g.giver_id === userId && g.trip_id === tripId && g.status !== "revoked")) return { ok: false, reason: "You've used this trip's gift." };
  return { ok: true };
}

export interface GiftCandidate { traveler: TravelerRow; status: string; eligible: boolean }
/** Who on the trip can receive the gift, with the reason shown under their name. */
export function giftCandidates(travelers: TravelerRow[], marks: PassMarkRow[], giverUserId: string): GiftCandidate[] {
  return travelers.filter((t) => t.user_id !== giverUserId).map((traveler) => {
    if (!traveler.user_id) return { traveler, status: "Guest · will need to create an account", eligible: true };
    const mark = marks.find((m) => m.user_id === traveler.user_id);
    if (mark) return { traveler, status: `Already has Atlas Premium Pass · ${kindLabel(mark.kind).toLowerCase()}`, eligible: false };
    return { traveler, status: "Get Going account · no pass", eligible: true };
  });
}

export function giftStatusLabel(g: PassGiftRow, recipientName: string, now: Date): string {
  if (g.status === "accepted") return g.ends_at && new Date(g.ends_at).getTime() <= now.getTime() ? `Gift to ${recipientName} ended` : `Gifted · ${recipientName} accepted`;
  if (g.status === "sent") return new Date(g.expires_at).getTime() <= now.getTime() ? "Gift link expired" : `Gift sent · waiting for ${recipientName}`;
  return g.status === "expired" ? "Gift link expired" : "Gift withdrawn";
}

/** "7 days covers you through Tue, Mar 25 · the rest of your Tokyo and Kyoto nights." */
export function extensionCoverage(giftEnd: Date, days: number, trip: Pick<TripRow, "end_date" | "cities">, tz: string): { endsAt: Date; text: string } {
  const endsAt = extensionEndsAt(giftEnd, tz, days);
  const through = dateFmt(new Date(endsAt.getTime() - 60_000), tz, true);
  const tripEnd = trip.end_date ? zonedMidnight(addDays(trip.end_date, 1), tz) : null;
  const rest = tripEnd && endsAt.getTime() >= tripEnd.getTime();
  const cities = trip.cities.length ? trip.cities.slice(0, 2).join(" and ") : "";
  const tail = rest ? ` · the rest of your ${cities ? `${cities} ` : ""}nights.` : tripEnd ? ` · ${Math.round((tripEnd.getTime() - endsAt.getTime()) / 86_400_000)} more nights after that.` : ".";
  return { endsAt, text: `${days === 1 ? "1 day" : `${days} days`} covers you through ${through}${tail}` };
}

// ─── Offline packs ───────────────────────────────────────────────────────────
export interface OfflinePack { id: string; kind: "trip" | "map" | "language"; title: string; detail: string; sizeMb: number | null; wifiOnly: boolean }
const MAP_SIZES: Record<string, number> = { Tokyo: 412, Kyoto: 160, Osaka: 130, Lisbon: 210, Seoul: 380, London: 520, Paris: 440, "New York": 610 };
const sizeFor = (city: string) => MAP_SIZES[city] ?? 150 + ([...city].reduce((s, c) => s + c.charCodeAt(0), 0) % 160);
const LANGUAGE_NAMES: Record<string, string> = { ja: "Japanese", ko: "Korean", pt: "Portuguese", es: "Spanish", fr: "French", de: "German", it: "Italian", zh: "Chinese", th: "Thai", vi: "Vietnamese" };

/** What can be kept on the device for this trip: the data pack, one map per city (rest grouped), the text translation pack. */
export function offlinePacks(bundle: Pick<TripBundle, "trip" | "places" | "routes">): OfflinePack[] {
  const { trip } = bundle;
  const packs: OfflinePack[] = [{ id: `trip:${trip.id}`, kind: "trip", title: `${trip.name} · offline pack`, detail: "Trip, places, stays, routes, rates", sizeMb: null, wifiOnly: false }];
  const [first, ...rest] = trip.cities;
  if (first) packs.push({ id: `map:${trip.id}:${first}`, kind: "map", title: `${first} map`, detail: `${pluralNights(bundle.routes.length, "saved route")}`, sizeMb: sizeFor(first), wifiOnly: false });
  if (rest.length) packs.push({ id: `map:${trip.id}:${rest.join("+")}`, kind: "map", title: `${rest.join(" & ")} maps`, detail: "Wi-Fi only", sizeMb: rest.reduce((s, c) => s + sizeFor(c), 0), wifiOnly: true });
  const lang = trip.local_language ? LANGUAGE_NAMES[trip.local_language.split("-")[0]!] : null;
  if (lang) packs.push({ id: `lang:${trip.local_language}`, kind: "language", title: `${lang} translation pack`, detail: "Text only", sizeMb: 68, wifiOnly: false });
  return packs;
}
const pluralNights = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// ─── Settings ────────────────────────────────────────────────────────────────
export interface TripBehaviour { suggestLocalLanguage: boolean; suggestLocalCurrency: boolean; showHomeTime: boolean; quickAction: boolean }
export const DEFAULT_SETTINGS: TripBehaviour = { suggestLocalLanguage: true, suggestLocalCurrency: true, showHomeTime: true, quickAction: true };
export const SETTING_COPY: Record<keyof TripBehaviour, { title: string; detail: string }> = {
  suggestLocalLanguage: { title: "Suggest local language", detail: "Translate opens with the trip's language" },
  suggestLocalCurrency: { title: "Suggest local currency", detail: "Currency and Split default to the trip" },
  showHomeTime: { title: "Show home time", detail: "Alongside local time on Home" },
  quickAction: { title: "Quick action button", detail: "Contextual: Add place, Scan, Translate…" },
};
/** Profile.settings is free-form JSON in the database; only known boolean keys are read. */
export function readSettings(json: Json | null | undefined): TripBehaviour {
  const out = { ...DEFAULT_SETTINGS };
  if (json && typeof json === "object" && !Array.isArray(json)) for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof TripBehaviour)[]) if (typeof json[k] === "boolean") out[k] = json[k];
  return out;
}

/** Profile header stats: trips, saved places across them, distinct countries. */
export function profileStats(trips: { place_count: number; countries: string[] }[]): { trips: number; places: number; countries: number } {
  return { trips: trips.length, places: trips.reduce((s, t) => s + t.place_count, 0), countries: new Set(trips.flatMap((t) => t.countries)).size };
}
