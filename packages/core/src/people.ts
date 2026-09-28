/** People — travelers with and without accounts, how they show up, and the groups they're in. */
import type { RouteBranchRow, TravelerRow, TripRow } from "./db/database.types";
import type { TripBundle } from "./domain";
import { formatDateRange } from "./format";
import { tripDates } from "./selectors";

export type TravelerKind = "you" | "account" | "guest";

export function travelerKind(t: Pick<TravelerRow, "user_id">, userId: string | null): TravelerKind {
  if (t.user_id && t.user_id === userId) return "you";
  return t.user_id ? "account" : "guest";
}

/** "You · Organizer" / "Get Going account" / "Guest". */
export function travelerStatus(t: Pick<TravelerRow, "user_id">, trip: Pick<TripRow, "owner_id">, userId: string | null): string {
  const kind = travelerKind(t, userId);
  if (kind === "you") return trip.owner_id === userId ? "You · Organizer" : "You";
  if (kind === "account") return t.user_id === trip.owner_id ? "Organizer" : "Get Going account";
  return "Guest";
}

/** "All 14 nights" / "Tokyo only, Mar 15–20" / "Joining Mar 18". */
export function joiningLabel(t: Pick<TravelerRow, "joining_start" | "joining_end" | "joining_note">, trip: Pick<TripRow, "start_date" | "end_date">): string {
  const nights = Math.max(0, tripDates(trip).length - 1);
  const whole = !t.joining_start && !t.joining_end;
  if (whole) return nights ? `All ${nights} nights` : "Whole trip";
  const range = formatDateRange(t.joining_start ?? trip.start_date, t.joining_end ?? trip.end_date);
  return t.joining_note ? `${t.joining_note}, ${range}` : range;
}

/** Everything on a traveler's row: status, dates, home currency or contact. */
export function travelerDetail(t: TravelerRow, trip: Pick<TripRow, "owner_id" | "start_date" | "end_date">, userId: string | null, homeCurrency?: string | null): string {
  const parts = [travelerStatus(t, trip, userId), joiningLabel(t, trip)];
  const cur = t.home_currency ?? (travelerKind(t, userId) === "you" ? homeCurrency : null);
  if (cur) parts.push(`Home ${cur}`);
  else if (t.phone) parts.push(t.phone);
  else if (t.email) parts.push(t.email);
  return parts.join(" · ");
}

export interface TravelerGroup { branch: RouteBranchRow; routeName: string; travelers: TravelerRow[] }

/** Groups come from tree routes: each branch is a group with its travelers. */
export function travelerGroups(bundle: Pick<TripBundle, "routes" | "routeBranches" | "routeBranchTravelers" | "travelers">): TravelerGroup[] {
  return bundle.routeBranches.map((b) => ({
    branch: b,
    routeName: bundle.routes.find((r) => r.id === b.route_id)?.name ?? "Route",
    travelers: bundle.travelers.filter((t) => bundle.routeBranchTravelers.some((x) => x.branch_id === b.id && x.traveler_id === t.id)),
  }));
}

/** Palette for new travelers: the next colour nobody on the trip uses yet. */
export const TRAVELER_COLORS = ["#2F5D3A", "#E0703A", "#5568C9", "#C9516F", "#E0A020", "#2B8C8C", "#8C5AA6", "#B5651D"];
export function nextTravelerColor(existing: Pick<TravelerRow, "color">[]): string {
  const used = new Set(existing.map((t) => t.color.toUpperCase()));
  return TRAVELER_COLORS.find((c) => !used.has(c.toUpperCase())) ?? TRAVELER_COLORS[existing.length % TRAVELER_COLORS.length]!;
}

/** Text for the invite share sheet; the link is the only thing that grants access, and it expires. */
export function inviteText(tripName: string, inviter: string, url: string): string {
  return `${inviter} added you to "${tripName}" on Get Going. Open this link to see the plan, routes and bills: ${url}\nIt works for 30 days and you'll need a Get Going account to join.`;
}
