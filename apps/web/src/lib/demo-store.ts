import "server-only";
import { cookies } from "next/headers";
import {
  demoBundle, demoPastBills, demoTrips, nextTravelerColor, type BillInput, type BillListItem, type ClaimView, type ItineraryItem, type Phrase, type PhraseInput, type RouteInput, type TravelerInput, type TravelerRow,
  type TreeInput, type TripBundle, type TripCurrencyInput, type TripCurrencyRow, type TripInput, type TripInviteRow, type TripListItem,
} from "@voya/core";

/**
 * In-memory demo data so create/assign flows work end-to-end without Supabase.
 * State is keyed by a per-browser demo session id (cookie set at demo sign-in), so
 * parallel users/tests are isolated from each other — the same guarantee RLS gives
 * the real backend. Resets on server restart; capped to bound memory.
 */
export const DEMO_SID_COOKIE = "voya_demo_sid";
const MAX_SESSIONS = 200;

interface DemoState { trips: TripListItem[]; bundles: Map<string, TripBundle> }
const sessions = new Map<string, DemoState>();

function fresh(): DemoState {
  return { trips: structuredClone(demoTrips), bundles: new Map([[demoBundle.trip.id, structuredClone(demoBundle)]]) };
}

/** Every sandbox's bundles: token lookups (claim links, invites) work across browsers, like the real database. */
async function allBundles(): Promise<TripBundle[]> {
  await state();
  return [...sessions.values()].flatMap((s) => [...s.bundles.values()]);
}

async function state(): Promise<DemoState> {
  const sid = (await cookies()).get(DEMO_SID_COOKIE)?.value ?? "anonymous";
  let s = sessions.get(sid);
  if (!s) {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!); // drop oldest
    s = fresh();
    sessions.set(sid, s);
  }
  return s;
}

export const demoStore = {
  trips: async () => (await state()).trips,
  bundle: async (id: string) => (await state()).bundles.get(id) ?? null,

  async createTrip(input: TripInput, ownerId: string): Promise<TripListItem> {
    const s = await state();
    const id = crypto.randomUUID();
    const ts = new Date().toISOString();
    const trip: TripListItem = {
      id, owner_id: ownerId, name: input.name, cover_letter: input.name[0]!.toUpperCase(),
      countries: input.countries, cities: input.cities, start_date: input.startDate, end_date: input.endDate,
      status: input.startDate ? "upcoming" : "draft", local_currency: input.localCurrency, local_tz: input.localTz,
      local_language: input.localLanguage, notes: input.notes, created_at: ts, updated_at: ts, traveler_count: 1, place_count: 0,
    };
    s.trips.push(trip);
    s.bundles.set(id, {
      trip, travelers: [{ id: crypto.randomUUID(), trip_id: id, user_id: ownerId, name: "Joe Obligar", color: "#2F5D3A", created_at: ts, email: null, phone: null, home_currency: null, joining_start: null, joining_end: null, joining_note: null, updated_at: ts }],
      categories: [], places: [], placeCategories: [], stays: [], itinerary: [], routes: [], routeStops: [], routeBranches: [], routeBranchTravelers: [], phrases: [], tripCurrencies: [], tripInvites: [], bills: [], billItems: [], billParticipants: [], billShares: [],
    });
    return trip;
  },

  async saveRoute(tripId: string, input: Omit<RouteInput, "tripId">, userId: string) {
    const b = (await state()).bundles.get(tripId);
    if (!b) return null;
    const id = crypto.randomUUID(), ts = new Date().toISOString();
    b.routes.push({ id, trip_id: tripId, name: input.name, day: input.day, mode: input.mode, notes: null, created_by: userId, created_at: ts, updated_at: ts });
    input.stops.forEach((s, i) => b.routeStops.push({ id: crypto.randomUUID(), route_id: id, trip_id: tripId, place_id: s.placeId, sort_order: i, planned_time: s.plannedTime, dwell_min: null, mode: null, branch_id: null, created_at: ts }));
    return id;
  },

  /** Create or replace a navigation tree (mirrors the save_route_tree RPC). Ids arrive already minted by the action. */
  async saveTree(tripId: string, tree: Omit<TreeInput, "tripId">, userId: string) {
    const b = (await state()).bundles.get(tripId);
    if (!b) return null;
    if (tree.routeId && !b.routes.some((r) => r.id === tree.routeId)) return null;
    const id = tree.routeId ?? crypto.randomUUID(), ts = new Date().toISOString();
    const oldBranches = new Set(b.routeBranches.filter((x) => x.route_id === id).map((x) => x.id));
    b.routeStops = b.routeStops.filter((s) => s.route_id !== id);
    b.routeBranches = b.routeBranches.filter((x) => x.route_id !== id);
    b.routeBranchTravelers = b.routeBranchTravelers.filter((x) => !oldBranches.has(x.branch_id));
    if (tree.routeId) b.routes = b.routes.map((r) => (r.id === id ? { ...r, name: tree.name, day: tree.day, mode: tree.mode, updated_at: ts } : r));
    else b.routes.push({ id, trip_id: tripId, name: tree.name, day: tree.day, mode: tree.mode, notes: null, created_by: userId, created_at: ts, updated_at: ts });
    for (const s of tree.stops) b.routeStops.push({ id: s.id, route_id: id, trip_id: tripId, place_id: s.placeId, sort_order: s.sortOrder, planned_time: s.plannedTime, dwell_min: s.dwellMin, mode: s.mode, branch_id: s.branchId, created_at: ts });
    for (const br of tree.branches) {
      b.routeBranches.push({ id: br.id, route_id: id, trip_id: tripId, name: br.name, color: br.color, sort_order: br.sortOrder, split_after_stop_id: br.splitAfterStopId, merge_mode: br.mergeMode, created_at: ts });
      for (const t of br.travelerIds) b.routeBranchTravelers.push({ branch_id: br.id, traveler_id: t, trip_id: tripId });
    }
    return id;
  },

  async addPhrase(input: PhraseInput, userId: string): Promise<Phrase | null> {
    const b = (await state()).bundles.get(input.tripId);
    if (!b || b.phrases.length >= 200) return null;
    const row: Phrase = {
      id: crypto.randomUUID(), trip_id: input.tripId, source_text: input.sourceText, source_lang: input.sourceLang, target_text: input.targetText,
      target_lang: input.targetLang, romanized: input.romanized, sort_order: b.phrases.length, created_by: userId, created_at: new Date().toISOString(),
    };
    b.phrases.push(row);
    return row;
  },
  async removePhrase(tripId: string, phraseId: string): Promise<boolean> {
    const b = (await state()).bundles.get(tripId);
    if (!b) return false;
    const before = b.phrases.length;
    b.phrases = b.phrases.filter((p) => p.id !== phraseId);
    return b.phrases.length < before;
  },
  async addCurrency(input: TripCurrencyInput): Promise<TripCurrencyRow | null> {
    const b = (await state()).bundles.get(input.tripId);
    if (!b) return null;
    const existing = b.tripCurrencies.find((c) => c.code === input.code);
    if (existing) return existing;
    const row: TripCurrencyRow = { trip_id: input.tripId, code: input.code, label: input.label, sort_order: b.tripCurrencies.length, created_at: new Date().toISOString() };
    b.tripCurrencies.push(row);
    return row;
  },
  async removeCurrency(tripId: string, code: string): Promise<boolean> {
    const b = (await state()).bundles.get(tripId);
    if (!b) return false;
    const before = b.tripCurrencies.length;
    b.tripCurrencies = b.tripCurrencies.filter((c) => c.code !== code);
    return b.tripCurrencies.length < before;
  },

  // ─── People ───────────────────────────────────────────────────────────────
  async addTraveler(input: TravelerInput): Promise<TravelerRow | null> {
    const b = (await state()).bundles.get(input.tripId);
    if (!b || b.travelers.length >= 50) return null;
    const ts = new Date().toISOString();
    const row: TravelerRow = { id: crypto.randomUUID(), trip_id: input.tripId, user_id: null, name: input.name, color: input.color ?? nextTravelerColor(b.travelers), created_at: ts, email: input.email, phone: input.phone, home_currency: input.homeCurrency, joining_start: input.joiningStart, joining_end: input.joiningEnd, joining_note: input.joiningNote, updated_at: ts };
    b.travelers.push(row);
    const trip = (await state()).trips.find((t) => t.id === input.tripId);
    if (trip) trip.traveler_count = b.travelers.length;
    return row;
  },
  async updateTraveler(id: string, input: TravelerInput): Promise<TravelerRow | null> {
    const b = (await state()).bundles.get(input.tripId);
    const t = b?.travelers.find((x) => x.id === id);
    if (!b || !t) return null;
    Object.assign(t, { name: input.name, email: input.email, phone: input.phone, home_currency: input.homeCurrency, joining_start: input.joiningStart, joining_end: input.joiningEnd, joining_note: input.joiningNote, color: input.color ?? t.color, updated_at: new Date().toISOString() });
    return t;
  },
  async removeTraveler(tripId: string, id: string): Promise<boolean> {
    const s = await state();
    const b = s.bundles.get(tripId);
    if (!b) return false;
    const t = b.travelers.find((x) => x.id === id);
    if (!t || t.user_id) return false; // account holders leave via membership, not this button
    b.travelers = b.travelers.filter((x) => x.id !== id);
    b.routeBranchTravelers = b.routeBranchTravelers.filter((x) => x.traveler_id !== id);
    const trip = s.trips.find((x) => x.id === tripId);
    if (trip) trip.traveler_count = b.travelers.length;
    return true;
  },
  async createInvite(tripId: string, travelerId: string | null, userId: string): Promise<TripInviteRow | null> {
    const b = (await state()).bundles.get(tripId);
    if (!b) return null;
    const existing = b.tripInvites.find((i) => i.traveler_id === travelerId && !i.accepted_at && new Date(i.expires_at) > new Date());
    if (existing) return existing;
    const token = [...crypto.getRandomValues(new Uint8Array(18))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const row: TripInviteRow = { token, trip_id: tripId, traveler_id: travelerId, role: "editor", created_by: userId, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), accepted_by: null, accepted_at: null, created_at: new Date().toISOString() };
    b.tripInvites.push(row);
    return row;
  },
  async invitePreview(token: string) {
    for (const b of await allBundles()) {
      const i = b.tripInvites.find((x) => x.token === token && new Date(x.expires_at) > new Date());
      if (i) return { trip_name: b.trip.name, inviter: "Joe", traveler: b.travelers.find((t) => t.id === i.traveler_id)?.name ?? null, expires_at: i.expires_at, accepted: !!i.accepted_at };
    }
    return null;
  },

  // ─── Split ────────────────────────────────────────────────────────────────
  /** Create or replace a bill (mirrors the save_bill RPC). Existing participants keep their claim tokens. */
  async saveBill(input: BillInput, userId: string): Promise<string | null> {
    const b = (await state()).bundles.get(input.tripId);
    if (!b) return null;
    const ts = new Date().toISOString();
    const id = input.billId ?? crypto.randomUUID();
    const old = input.billId ? b.bills.find((x) => x.id === id) : null;
    if (input.billId && !old) return null;
    const oldPeople = new Map(b.billParticipants.filter((p) => p.bill_id === id).map((p) => [p.id, p]));
    b.billItems = b.billItems.filter((i) => i.bill_id !== id);
    b.billParticipants = b.billParticipants.filter((p) => p.bill_id !== id);
    b.billShares = b.billShares.filter((s) => s.bill_id !== id);
    const bill = {
      id, trip_id: input.tripId, place_id: input.placeId, merchant: input.merchant, currency: input.currency, status: input.status, bill_date: input.billDate,
      tax_amount: input.taxAmount, tax_label: input.taxLabel, service_amount: input.serviceAmount, discount_amount: input.discountAmount, rounding_unit: input.roundingUnit, tax_mode: input.taxMode,
      paid_by: input.paidBy, receipt_pages: old?.receipt_pages ?? 0, created_by: old?.created_by ?? userId, created_at: old?.created_at ?? ts, updated_at: ts,
      closed_at: input.status === "settled" ? old?.closed_at ?? ts : null,
    };
    b.bills = [bill, ...b.bills.filter((x) => x.id !== id)];
    input.participants.forEach((p) => {
      const prev = oldPeople.get(p.id);
      b.billParticipants.push({ id: p.id, bill_id: id, trip_id: input.tripId, traveler_id: p.travelerId, name: p.name, color: p.color, home_currency: p.homeCurrency, claim_token: prev?.claim_token ?? [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join(""), claim_status: prev?.claim_status ?? "none", claim_expires_at: prev?.claim_expires_at ?? new Date(Date.now() + 30 * 86_400_000).toISOString(), created_at: prev?.created_at ?? ts });
    });
    input.items.forEach((i, n) => b.billItems.push({ id: i.id, bill_id: id, trip_id: input.tripId, name: i.name, local_name: i.localName, qty: i.qty, unit_price: i.unitPrice, confidence: i.confidence, sort_order: n, created_at: ts }));
    for (const s of input.shares) b.billShares.push({ item_id: s.itemId, participant_id: s.participantId, bill_id: id, trip_id: input.tripId });
    return id;
  },
  async deleteBill(tripId: string, billId: string): Promise<boolean> {
    const b = (await state()).bundles.get(tripId);
    if (!b || !b.bills.some((x) => x.id === billId)) return false;
    b.bills = b.bills.filter((x) => x.id !== billId);
    b.billItems = b.billItems.filter((x) => x.bill_id !== billId);
    b.billParticipants = b.billParticipants.filter((x) => x.bill_id !== billId);
    b.billShares = b.billShares.filter((x) => x.bill_id !== billId);
    return true;
  },
  async markClaimSent(tripId: string, billId: string, participantId: string): Promise<string | null> {
    const b = (await state()).bundles.get(tripId);
    const p = b?.billParticipants.find((x) => x.id === participantId && x.bill_id === billId);
    if (!p?.claim_token) return null;
    if (p.claim_status === "none") p.claim_status = "sent";
    return p.claim_token;
  },
  async listBills(): Promise<BillListItem[]> {
    const s = await state();
    const mine = [...s.bundles.values()].flatMap((b) => b.bills.map((bill) => ({ ...bill, trip_name: b.trip.name, people: b.billParticipants.filter((p) => p.bill_id === bill.id).length })));
    return [...mine, ...demoPastBills].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  /** Token-scoped view for the public claim page (mirrors bill_claim_view; marks the link opened). */
  async claimView(token: string): Promise<ClaimView | null> {
    for (const b of await allBundles()) {
      const me = b.billParticipants.find((p) => p.claim_token === token && p.claim_status !== "none" && new Date(p.claim_expires_at) > new Date());
      if (!me) continue;
      const bill = b.bills.find((x) => x.id === me.bill_id)!;
      if (me.claim_status === "sent") me.claim_status = "opened";
      const first = (n: string) => n.split(" ")[0]!;
      return {
        merchant: bill.merchant, currency: bill.currency, status: bill.status === "settled" ? "settled" : "open",
        sender: first(b.billParticipants.find((p) => p.id === bill.paid_by)?.name ?? "Joe"), you: { id: me.id, name: first(me.name) },
        tax_amount: bill.tax_amount, service_amount: bill.service_amount, discount_amount: bill.discount_amount, tax_mode: bill.tax_mode, rounding_unit: bill.rounding_unit,
        participants: b.billParticipants.filter((p) => p.bill_id === bill.id).map((p) => ({ id: p.id, name: first(p.name) })),
        items: b.billItems.filter((i) => i.bill_id === bill.id).sort((x, y) => x.sort_order - y.sort_order).map((i) => ({ id: i.id, name: i.name, local_name: i.local_name, qty: i.qty, unit_price: i.unit_price })),
        shares: b.billShares.filter((x) => x.bill_id === bill.id).map((x) => ({ item_id: x.item_id, participant_id: x.participant_id })),
      };
    }
    return null;
  },
  async claimSubmit(token: string, itemIds: string[]): Promise<ClaimView | { error: string }> {
    for (const b of await allBundles()) {
      const me = b.billParticipants.find((p) => p.claim_token === token && p.claim_status !== "none" && new Date(p.claim_expires_at) > new Date());
      if (!me) continue;
      const bill = b.bills.find((x) => x.id === me.bill_id)!;
      if (bill.status !== "open") return { error: "This bill is closed." };
      const valid = new Set(b.billItems.filter((i) => i.bill_id === bill.id).map((i) => i.id));
      b.billShares = b.billShares.filter((x) => x.participant_id !== me.id);
      for (const id of itemIds) if (valid.has(id)) b.billShares.push({ item_id: id, participant_id: me.id, bill_id: bill.id, trip_id: bill.trip_id });
      me.claim_status = "claimed";
      return (await this.claimView(token))!;
    }
    return { error: "Link not found or expired." };
  },

  async assignPlaceToSlot(tripId: string, itemId: string, placeId: string): Promise<ItineraryItem | null> {
    const b = (await state()).bundles.get(tripId);
    const item = b?.itinerary.find((i) => i.id === itemId);
    if (!b || !item || !b.places.some((p) => p.id === placeId)) return null;
    item.place_id = placeId;
    item.note = item.title ? `Was: ${item.title}` : item.note;
    return item;
  },
};
