import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEMO_NOW, billSchema, demoBundle, demoEntitlements, demoPastBills, demoTrips, listBills, listEntitlements, listTrips, loadTripBundle, nextTravelerColor, phraseSchema, pickActiveTrip, routeSchema,
  travelerSchema, treeSchema, tripCurrencySchema,
  type BillInput, type BillListItem, type EntitlementRow, type Phrase, type PhraseInput, type RouteInput, type RouteTree, type TravelerInput, type TravelerRow, type TripBundle, type TripCurrencyRow, type TripListItem,
} from "@voya/core";
import { getSupabase, isDemo, prefs } from "./supabase";
import { useSession } from "./session";

interface DataState {
  now: Date;
  trips: TripListItem[];
  active: TripListItem | null;
  bundle: TripBundle | null;
  loading: boolean;
  setActive(id: string): Promise<void>;
  assignPlaceToSlot(itemId: string, placeId: string): Promise<void>;
  /** Save a named multi-stop route on the active trip; resolves the new route id or an error message. */
  saveRoute(input: Omit<RouteInput, "tripId">): Promise<{ id: string } | { error: string }>;
  /** Create or replace a navigation tree on the active trip. */
  saveTree(tree: RouteTree): Promise<{ id: string } | { error: string }>;
  /** Saved phrases and extra currencies live on the trip so every traveler shares them. */
  addPhrase(input: Omit<PhraseInput, "tripId">): Promise<Phrase | { error: string }>;
  removePhrase(id: string): Promise<{ ok: true } | { error: string }>;
  addCurrency(code: string, label: string | null): Promise<TripCurrencyRow | { error: string }>;
  removeCurrency(code: string): Promise<{ ok: true } | { error: string }>;
  /** People: guests on the active trip, and invite links (the only way a guest becomes a member). */
  addTraveler(input: Omit<TravelerInput, "tripId">): Promise<TravelerRow | { error: string }>;
  updateTraveler(id: string, input: Omit<TravelerInput, "tripId">): Promise<TravelerRow | { error: string }>;
  removeTraveler(id: string): Promise<{ ok: true } | { error: string }>;
  createInvite(travelerId: string): Promise<{ url: string } | { error: string }>;
  /** Split: bills on the active trip, claim links, and the caller's Atlas Premium Pass. */
  entitlements: EntitlementRow[];
  pastBills: BillListItem[];
  saveBill(input: Omit<BillInput, "tripId">): Promise<{ id: string } | { error: string }>;
  deleteBill(id: string): Promise<{ ok: true } | { error: string }>;
  claimLink(billId: string, participantId: string): Promise<{ url: string } | { error: string }>;
  refresh(): Promise<void>;
}

const Ctx = createContext<DataState | null>(null);
/** Demo data is plain JSON; a JSON round-trip is a dependable deep clone on every RN/Jest runtime. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Trip data for the signed-in user; demo mode keeps a mutable in-memory copy. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo] = useState(() => ({ trips: clone(demoTrips), bundles: new Map([[demoBundle.trip.id, clone(demoBundle)]]), entitlements: clone(demoEntitlements) }));
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [pastBills, setPastBills] = useState<BillListItem[]>([]);
  const now = useMemo(() => (isDemo ? DEMO_NOW : new Date()), []);

  /** Pure load step; callers apply the result so state changes always follow an await. */
  const load = useCallback(async () => {
    if (!user) return { trips: [] as TripListItem[], activeId: null as string | null, bundle: null as TripBundle | null, entitlements: [] as EntitlementRow[], pastBills: [] as BillListItem[] };
    // Demo data is mutated in place; fresh references on every load so screens re-render after a save.
    const list = isDemo ? [...demo.trips] : await listTrips(await getSupabase());
    const saved = await prefs.get("activeTrip");
    const chosen = list.find((t) => t.id === saved) ?? pickActiveTrip(list, now, user.profile.home_tz);
    const demoBundleFor = (id: string) => { const x = demo.bundles.get(id); return x ? { ...x } : null; };
    const b = chosen ? (isDemo ? demoBundleFor(chosen.id) : await loadTripBundle(await getSupabase(), chosen.id)) : null;
    const ents = isDemo ? demo.entitlements : await listEntitlements(await getSupabase());
    const past = isDemo
      ? [...[...demo.bundles.values()].flatMap((x) => x.bills.map((bill) => ({ ...bill, trip_name: x.trip.name, people: x.billParticipants.filter((p) => p.bill_id === bill.id).length }))), ...demoPastBills]
      : await listBills(await getSupabase());
    return { trips: list, activeId: chosen?.id ?? null, bundle: b, entitlements: ents, pastBills: past };
  }, [user, demo, now]);
  const apply = useCallback((r: Awaited<ReturnType<typeof load>>) => { setTrips(r.trips); setActiveId(r.activeId); setBundle(r.bundle); setEntitlements(r.entitlements); setPastBills(r.pastBills); setLoading(false); }, []);
  const refresh = useCallback(async () => apply(await load()), [load, apply]);

  useEffect(() => {
    let alive = true;
    load().then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [load, apply]);

  const setActive = useCallback(async (id: string) => {
    if (!trips.some((t) => t.id === id)) return;
    await prefs.set("activeTrip", id);
    await refresh();
  }, [trips, refresh]);

  const assignPlaceToSlot = useCallback(async (itemId: string, placeId: string) => {
    if (!bundle) return;
    if (isDemo) {
      const b = demo.bundles.get(bundle.trip.id);
      const item = b?.itinerary.find((i) => i.id === itemId);
      if (item && b?.places.some((p) => p.id === placeId)) item.place_id = placeId;
    } else {
      await (await getSupabase()).from("itinerary_items").update({ place_id: placeId, note: null }).eq("id", itemId).eq("trip_id", bundle.trip.id);
    }
    await refresh();
  }, [bundle, demo, refresh]);

  const saveRoute = useCallback<DataState["saveRoute"]>(async (input) => {
    if (!bundle || !user) return { error: "No active trip." };
    const parsed = routeSchema.safeParse({ ...input, tripId: bundle.trip.id });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the route." };
    if (!parsed.data.stops.every((s) => bundle.places.some((p) => p.id === s.placeId))) return { error: "One of the stops isn't on this trip." };
    const { tripId, name, day, mode, stops } = parsed.data;
    // Ids are minted here (not read back with RETURNING) so RLS can't refuse the read of a row it just accepted.
    const id = crypto.randomUUID();
    if (isDemo) {
      const b = demo.bundles.get(tripId);
      if (!b) return { error: "No active trip." };
      const ts = new Date().toISOString();
      b.routes.push({ id, trip_id: tripId, name, day, mode, notes: null, created_by: user.id, created_at: ts, updated_at: ts });
      stops.forEach((s, i) => b.routeStops.push({ id: crypto.randomUUID(), route_id: id, trip_id: tripId, place_id: s.placeId, sort_order: i, planned_time: s.plannedTime, dwell_min: null, mode: null, branch_id: null, created_at: ts }));
    } else {
      const db = await getSupabase();
      const { error } = await db.from("routes").insert({ id, trip_id: tripId, name, day, mode, created_by: user.id });
      if (error) return { error: "Couldn't save the route." };
      const { error: e2 } = await db.from("route_stops").insert(stops.map((s, i) => ({ route_id: id, trip_id: tripId, place_id: s.placeId, sort_order: i, planned_time: s.plannedTime })));
      if (e2) return { error: "Couldn't save the stops." };
    }
    await refresh();
    return { id };
  }, [bundle, user, demo, refresh]);

  const saveTree = useCallback<DataState["saveTree"]>(async (tree) => {
    if (!bundle || !user) return { error: "No active trip." };
    const parsed = treeSchema.safeParse({ ...tree, tripId: bundle.trip.id });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the route." };
    const t = parsed.data;
    if (!t.stops.every((s) => bundle.places.some((p) => p.id === s.placeId)) || !t.branches.every((b) => b.travelerIds.every((x) => bundle.travelers.some((tr) => tr.id === x)))) return { error: "One of the stops or travelers isn't on this trip." };
    // Row ids are minted here, never reused from the editor.
    const stopIds = new Map(t.stops.map((s) => [s.id, crypto.randomUUID()]));
    const branchIds = new Map(t.branches.map((b) => [b.id, crypto.randomUUID()]));
    const stops = t.stops.map((s) => ({ ...s, id: stopIds.get(s.id)!, branchId: s.branchId ? branchIds.get(s.branchId)! : null }));
    const branches = t.branches.map((b) => ({ ...b, id: branchIds.get(b.id)!, splitAfterStopId: stopIds.get(b.splitAfterStopId)! }));
    const id = t.routeId ?? crypto.randomUUID();
    if (isDemo) {
      const b = demo.bundles.get(t.tripId);
      if (!b || (t.routeId && !b.routes.some((r) => r.id === t.routeId))) return { error: "Route not found." };
      const ts = new Date().toISOString();
      const old = new Set(b.routeBranches.filter((x) => x.route_id === id).map((x) => x.id));
      b.routeStops = b.routeStops.filter((x) => x.route_id !== id);
      b.routeBranches = b.routeBranches.filter((x) => x.route_id !== id);
      b.routeBranchTravelers = b.routeBranchTravelers.filter((x) => !old.has(x.branch_id));
      if (t.routeId) b.routes = b.routes.map((r) => (r.id === id ? { ...r, name: t.name, day: t.day, mode: t.mode, updated_at: ts } : r));
      else b.routes.push({ id, trip_id: t.tripId, name: t.name, day: t.day, mode: t.mode, notes: null, created_by: user.id, created_at: ts, updated_at: ts });
      for (const s of stops) b.routeStops.push({ id: s.id, route_id: id, trip_id: t.tripId, place_id: s.placeId, sort_order: s.sortOrder, planned_time: s.plannedTime, dwell_min: s.dwellMin, mode: s.mode, branch_id: s.branchId, created_at: ts });
      for (const br of branches) {
        b.routeBranches.push({ id: br.id, route_id: id, trip_id: t.tripId, name: br.name, color: br.color, sort_order: br.sortOrder, split_after_stop_id: br.splitAfterStopId, merge_mode: br.mergeMode, created_at: ts });
        for (const tr of br.travelerIds) b.routeBranchTravelers.push({ branch_id: br.id, traveler_id: tr, trip_id: t.tripId });
      }
    } else {
      const db = await getSupabase();
      const { error } = await db.rpc("save_route_tree", {
        p_route_id: t.routeId, p_trip_id: t.tripId, p_name: t.name, p_day: t.day, p_mode: t.mode,
        p_stops: stops.map((s) => ({ id: s.id, place_id: s.placeId, branch_id: s.branchId, sort_order: s.sortOrder, planned_time: s.plannedTime, dwell_min: s.dwellMin, mode: s.mode })),
        p_branches: branches.map((b) => ({ id: b.id, name: b.name, color: b.color, sort_order: b.sortOrder, split_after_stop_id: b.splitAfterStopId, merge_mode: b.mergeMode, traveler_ids: b.travelerIds })),
      });
      if (error) return { error: "Couldn't save the route." };
    }
    await refresh();
    return { id };
  }, [bundle, user, demo, refresh]);

  const addPhrase = useCallback<DataState["addPhrase"]>(async (input) => {
    if (!bundle || !user) return { error: "No active trip." };
    const parsed = phraseSchema.safeParse({ ...input, tripId: bundle.trip.id });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the phrase." };
    const p = parsed.data;
    if (bundle.phrases.some((x) => x.source_text === p.sourceText && x.target_lang === p.targetLang)) return { error: "That phrase is already saved." };
    if (bundle.phrases.length >= 200) return { error: "A trip can hold up to 200 saved phrases." };
    const row: Phrase = { id: crypto.randomUUID(), trip_id: p.tripId, source_text: p.sourceText, source_lang: p.sourceLang, target_text: p.targetText, target_lang: p.targetLang, romanized: p.romanized, sort_order: bundle.phrases.length, created_by: user.id, created_at: new Date().toISOString() };
    if (isDemo) {
      demo.bundles.get(p.tripId)?.phrases.push(row);
    } else {
      const { created_at: _c, ...values } = row;
      const { error } = await (await getSupabase()).from("phrases").insert(values);
      if (error) return { error: "Couldn't save the phrase." };
    }
    await refresh();
    return row;
  }, [bundle, user, demo, refresh]);

  const removePhrase = useCallback<DataState["removePhrase"]>(async (id) => {
    if (!bundle) return { error: "No active trip." };
    if (isDemo) {
      const b = demo.bundles.get(bundle.trip.id);
      if (b) b.phrases = b.phrases.filter((x) => x.id !== id);
    } else {
      const { error } = await (await getSupabase()).from("phrases").delete().eq("id", id).eq("trip_id", bundle.trip.id);
      if (error) return { error: "Couldn't remove the phrase." };
    }
    await refresh();
    return { ok: true };
  }, [bundle, demo, refresh]);

  const addCurrency = useCallback<DataState["addCurrency"]>(async (code, label) => {
    if (!bundle) return { error: "No active trip." };
    const parsed = tripCurrencySchema.safeParse({ tripId: bundle.trip.id, code, label });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the currency." };
    if (bundle.tripCurrencies.length >= 12) return { error: "Up to 12 currencies per trip." };
    const row: TripCurrencyRow = { trip_id: parsed.data.tripId, code: parsed.data.code, label: parsed.data.label ? `${parsed.data.code} · ${parsed.data.label}` : null, sort_order: bundle.tripCurrencies.length, created_at: new Date().toISOString() };
    if (isDemo) {
      const b = demo.bundles.get(bundle.trip.id);
      if (b && !b.tripCurrencies.some((c) => c.code === row.code)) b.tripCurrencies.push(row);
    } else {
      const { created_at: _c, ...values } = row;
      const { error } = await (await getSupabase()).from("trip_currencies").upsert(values, { onConflict: "trip_id,code" });
      if (error) return { error: "Couldn't add the currency." };
    }
    await refresh();
    return row;
  }, [bundle, demo, refresh]);

  const removeCurrency = useCallback<DataState["removeCurrency"]>(async (code) => {
    if (!bundle) return { error: "No active trip." };
    if (isDemo) {
      const b = demo.bundles.get(bundle.trip.id);
      if (b) b.tripCurrencies = b.tripCurrencies.filter((c) => c.code !== code);
    } else {
      const { error } = await (await getSupabase()).from("trip_currencies").delete().eq("code", code).eq("trip_id", bundle.trip.id);
      if (error) return { error: "Couldn't remove the currency." };
    }
    await refresh();
    return { ok: true };
  }, [bundle, demo, refresh]);

  const addTraveler = useCallback<DataState["addTraveler"]>(async (input) => {
    if (!bundle) return { error: "No active trip." };
    const parsed = travelerSchema.safeParse({ ...input, tripId: bundle.trip.id });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
    if (bundle.travelers.length >= 50) return { error: "Up to 50 travelers per trip." };
    const p = parsed.data, ts = new Date().toISOString();
    const row: TravelerRow = { id: crypto.randomUUID(), trip_id: p.tripId, user_id: null, name: p.name, color: p.color ?? nextTravelerColor(bundle.travelers), created_at: ts, email: p.email, phone: p.phone, home_currency: p.homeCurrency, joining_start: p.joiningStart, joining_end: p.joiningEnd, joining_note: p.joiningNote, updated_at: ts };
    if (isDemo) {
      demo.bundles.get(p.tripId)?.travelers.push(row);
      const trip = demo.trips.find((x) => x.id === p.tripId); if (trip) trip.traveler_count += 1;
    } else {
      const { created_at: _c, updated_at: _u, user_id: _uid, ...values } = row;
      const { error } = await (await getSupabase()).from("travelers").insert(values);
      if (error) return { error: "Couldn't add the traveler." };
    }
    await refresh();
    return row;
  }, [bundle, demo, refresh]);

  const updateTraveler = useCallback<DataState["updateTraveler"]>(async (id, input) => {
    if (!bundle) return { error: "No active trip." };
    const current = bundle.travelers.find((t) => t.id === id);
    const parsed = travelerSchema.safeParse({ ...input, tripId: bundle.trip.id });
    if (!current || !parsed.success) return { error: parsed.success ? "Traveler not found." : parsed.error.issues[0]?.message ?? "Check the details." };
    const p = parsed.data;
    const values = { name: p.name, email: p.email, phone: p.phone, home_currency: p.homeCurrency, joining_start: p.joiningStart, joining_end: p.joiningEnd, joining_note: p.joiningNote, color: p.color ?? current.color };
    if (isDemo) {
      const t = demo.bundles.get(p.tripId)?.travelers.find((x) => x.id === id);
      if (t) Object.assign(t, values, { updated_at: new Date().toISOString() });
    } else {
      const { error } = await (await getSupabase()).from("travelers").update(values).eq("id", id).eq("trip_id", p.tripId);
      if (error) return { error: "Couldn't save the traveler." };
    }
    await refresh();
    return { ...current, ...values };
  }, [bundle, demo, refresh]);

  const removeTraveler = useCallback<DataState["removeTraveler"]>(async (id) => {
    if (!bundle) return { error: "No active trip." };
    const t = bundle.travelers.find((x) => x.id === id);
    if (!t) return { error: "Traveler not found." };
    if (t.user_id) return { error: "Travelers with an account leave from their own profile." };
    if (isDemo) {
      const b = demo.bundles.get(bundle.trip.id);
      if (b) { b.travelers = b.travelers.filter((x) => x.id !== id); b.routeBranchTravelers = b.routeBranchTravelers.filter((x) => x.traveler_id !== id); }
      const trip = demo.trips.find((x) => x.id === bundle.trip.id); if (trip) trip.traveler_count -= 1;
    } else {
      const { error } = await (await getSupabase()).from("travelers").delete().eq("id", id).eq("trip_id", bundle.trip.id).is("user_id", null);
      if (error) return { error: "Couldn't remove the traveler." };
    }
    await refresh();
    return { ok: true };
  }, [bundle, demo, refresh]);

  const createInvite = useCallback<DataState["createInvite"]>(async (travelerId) => {
    if (!bundle || !user) return { error: "No active trip." };
    const t = bundle.travelers.find((x) => x.id === travelerId);
    if (!t || t.user_id) return { error: "Only guests can be invited." };
    const site = process.env.EXPO_PUBLIC_SITE_URL ?? "https://voya.app";
    const existing = bundle.tripInvites.find((i) => i.traveler_id === travelerId && !i.accepted_at && new Date(i.expires_at) > new Date());
    if (existing) return { url: `${site}/join/${existing.token}` };
    if (isDemo) {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(18))).map((x) => x.toString(16).padStart(2, "0")).join("");
      demo.bundles.get(bundle.trip.id)?.tripInvites.push({ token, trip_id: bundle.trip.id, traveler_id: travelerId, role: "editor", created_by: user.id, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), accepted_by: null, accepted_at: null, created_at: new Date().toISOString() });
      await refresh();
      return { url: `${site}/join/${token}` };
    }
    // The token is issued by the database default; members may read their trip's invites back.
    const { data, error } = await (await getSupabase()).from("trip_invites").insert({ trip_id: bundle.trip.id, traveler_id: travelerId, created_by: user.id }).select("token").single();
    if (error || !data) return { error: "Couldn't create the invite." };
    await refresh();
    return { url: `${site}/join/${data.token}` };
  }, [bundle, user, demo, refresh]);

  const saveBill = useCallback<DataState["saveBill"]>(async (input) => {
    if (!bundle || !user) return { error: "No active trip." };
    const parsed = billSchema.safeParse({ ...input, tripId: bundle.trip.id });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the bill." };
    const b = parsed.data;
    if (b.billId && !bundle.bills.some((x) => x.id === b.billId)) return { error: "Bill not found." };
    if (!b.participants.every((p) => !p.travelerId || bundle.travelers.some((t) => t.id === p.travelerId))) return { error: "One of the people isn't on this trip." };
    const oldItems = new Set(bundle.billItems.filter((i) => i.bill_id === b.billId).map((i) => i.id));
    const oldPeople = new Map(bundle.billParticipants.filter((p) => p.bill_id === b.billId).map((p) => [p.id, p]));
    // Rows already on this bill keep their ids (and claim tokens); the rest are minted here.
    const itemIds = new Map(b.items.map((i) => [i.id, oldItems.has(i.id) ? i.id : crypto.randomUUID()]));
    const peopleIds = new Map(b.participants.map((p) => [p.id, oldPeople.has(p.id) ? p.id : crypto.randomUUID()]));
    const id = b.billId ?? crypto.randomUUID(), ts = new Date().toISOString();
    const items = b.items.map((i, n) => ({ id: itemIds.get(i.id)!, bill_id: id, trip_id: b.tripId, name: i.name, local_name: i.localName, qty: i.qty, unit_price: i.unitPrice, confidence: i.confidence, sort_order: n, created_at: ts }));
    const people = b.participants.map((p) => { const prev = oldPeople.get(p.id); return { id: peopleIds.get(p.id)!, bill_id: id, trip_id: b.tripId, traveler_id: p.travelerId, name: p.name, color: p.color, home_currency: p.homeCurrency, claim_token: prev?.claim_token ?? Array.from(crypto.getRandomValues(new Uint8Array(16))).map((x) => x.toString(16).padStart(2, "0")).join(""), claim_status: prev?.claim_status ?? ("none" as const), claim_expires_at: prev?.claim_expires_at ?? new Date(Date.now() + 30 * 86_400_000).toISOString(), created_at: prev?.created_at ?? ts }; });
    const shares = b.shares.map((s) => ({ item_id: itemIds.get(s.itemId)!, participant_id: peopleIds.get(s.participantId)!, bill_id: id, trip_id: b.tripId }));
    const paidBy = b.paidBy ? peopleIds.get(b.paidBy)! : null;
    if (isDemo) {
      const db = demo.bundles.get(b.tripId)!;
      const old = db.bills.find((x) => x.id === id);
      db.bills = [{ id, trip_id: b.tripId, place_id: b.placeId, merchant: b.merchant, currency: b.currency, status: b.status, bill_date: b.billDate, tax_amount: b.taxAmount, tax_label: b.taxLabel, service_amount: b.serviceAmount, discount_amount: b.discountAmount, rounding_unit: b.roundingUnit, tax_mode: b.taxMode, paid_by: paidBy, receipt_pages: old?.receipt_pages ?? 0, created_by: old?.created_by ?? user.id, created_at: old?.created_at ?? ts, updated_at: ts, closed_at: b.status === "settled" ? old?.closed_at ?? ts : null }, ...db.bills.filter((x) => x.id !== id)];
      db.billItems = [...db.billItems.filter((x) => x.bill_id !== id), ...items];
      db.billParticipants = [...db.billParticipants.filter((x) => x.bill_id !== id), ...people];
      db.billShares = [...db.billShares.filter((x) => x.bill_id !== id), ...shares];
    } else {
      const { error } = await (await getSupabase()).rpc("save_bill", {
        p_bill_id: b.billId, p_trip_id: b.tripId,
        p_bill: { place_id: b.placeId, merchant: b.merchant, currency: b.currency, status: b.status, bill_date: b.billDate, tax_amount: b.taxAmount, tax_label: b.taxLabel, service_amount: b.serviceAmount, discount_amount: b.discountAmount, rounding_unit: b.roundingUnit, tax_mode: b.taxMode, paid_by: paidBy },
        p_items: items.map((i) => ({ id: i.id, name: i.name, local_name: i.local_name, qty: i.qty, unit_price: i.unit_price, confidence: i.confidence, sort_order: i.sort_order })),
        p_participants: people.map((p) => ({ id: p.id, traveler_id: p.traveler_id, name: p.name, color: p.color, home_currency: p.home_currency })),
        p_shares: shares.map((s) => ({ item_id: s.item_id, participant_id: s.participant_id })),
      });
      if (error) return { error: "Couldn't save the bill." };
    }
    await refresh();
    return { id };
  }, [bundle, user, demo, refresh]);

  const deleteBill = useCallback<DataState["deleteBill"]>(async (id) => {
    if (!bundle) return { error: "No active trip." };
    if (isDemo) {
      const db = demo.bundles.get(bundle.trip.id);
      if (db) { db.bills = db.bills.filter((x) => x.id !== id); db.billItems = db.billItems.filter((x) => x.bill_id !== id); db.billParticipants = db.billParticipants.filter((x) => x.bill_id !== id); db.billShares = db.billShares.filter((x) => x.bill_id !== id); }
    } else {
      const { error } = await (await getSupabase()).from("bills").delete().eq("id", id).eq("trip_id", bundle.trip.id);
      if (error) return { error: "Couldn't delete the bill." };
    }
    await refresh();
    return { ok: true };
  }, [bundle, demo, refresh]);

  const claimLink = useCallback<DataState["claimLink"]>(async (billId, participantId) => {
    if (!bundle) return { error: "No active trip." };
    const site = process.env.EXPO_PUBLIC_SITE_URL ?? "https://voya.app";
    const p = bundle.billParticipants.find((x) => x.id === participantId && x.bill_id === billId);
    if (!p?.claim_token) return { error: "Couldn't create the link." };
    if (isDemo) {
      const dp = demo.bundles.get(bundle.trip.id)?.billParticipants.find((x) => x.id === participantId);
      if (dp && dp.claim_status === "none") dp.claim_status = "sent";
    } else if (p.claim_status === "none") {
      const { error } = await (await getSupabase()).from("bill_participants").update({ claim_status: "sent" }).eq("id", participantId).eq("trip_id", bundle.trip.id);
      if (error) return { error: "Couldn't create the link." };
    }
    await refresh();
    return { url: `${site}/s/${p.claim_token}` };
  }, [bundle, demo, refresh]);

  const active = trips.find((t) => t.id === activeId) ?? null;
  const value = useMemo<DataState>(() => ({ now, trips, active, bundle, loading, entitlements, pastBills, setActive, assignPlaceToSlot, saveRoute, saveTree, addPhrase, removePhrase, addCurrency, removeCurrency, addTraveler, updateTraveler, removeTraveler, createInvite, saveBill, deleteBill, claimLink, refresh }), [now, trips, active, bundle, loading, entitlements, pastBills, setActive, assignPlaceToSlot, saveRoute, saveTree, addPhrase, removePhrase, addCurrency, removeCurrency, addTraveler, updateTraveler, removeTraveler, createInvite, saveBill, deleteBill, claimLink, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
