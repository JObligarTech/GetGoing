import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  activePass, billBundle, billShareText, billTotal, computeBill, convert, formatMoney, fractionLabel, initial, languageByCode, splitRestEvenly, toggleShare,
  type BillInput, type BillItemRow, type BillParticipantRow, type BillShareRow, markForUser } from "@voya/core";
import { Button, Card, Chip, EmptyState, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { fx, translation } from "@/lib/providers";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

type Step = 1 | 2 | 3;
const STEP_TITLE: Record<Step, string> = { 1: "Check items", 2: "Who had what", 3: "Everyone's share" };

/**
 * Split editor: 1 Check items (OCR correction, add by hand), 2 Who had what (avatars on each
 * item, claim links), 3 Everyone's share (per person, home currency, close).
 */
export default function BillScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, step: qStep } = useLocalSearchParams<{ id: string; step?: string }>();
  const { user } = useSession();
  const { now, active, bundle, entitlements, saveBill, deleteBill, claimLink } = useData();
  const seed = useMemo(() => (bundle && id ? billBundle(bundle, id) : null), [bundle, id]);
  // Edits are kept per bill id; the seed re-derives when the bundle reloads after a save.
  const [edits, setEdits] = useState<{ key: string; bill: BillItemRow extends never ? never : NonNullable<typeof seed>["bill"]; items: BillItemRow[]; people: BillParticipantRow[]; shares: BillShareRow[] } | null>(null);
  const cur = edits?.key === id ? edits : seed ? { key: id, bill: seed.bill, items: seed.items, people: seed.participants, shares: seed.shares } : null;
  const set = (patch: Partial<NonNullable<typeof cur>>) => { if (cur) setEdits({ ...cur, ...patch }); };
  const [step, setStep] = useState<Step>(qStep === "2" ? 2 : qStep === "3" ? 3 : seed?.bill.status === "settled" ? 3 : seed?.shares.length ? 2 : 1);
  const [selected, setSelected] = useState<string | null>(seed?.bill.paid_by ?? seed?.participants[0]?.id ?? null);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ name: "", price: "", qty: 1, who: [] as string[] });
  const homeCurrency = user?.profile.home_currency ?? "USD";

  const billCurrency = cur?.bill.currency;
  const homes = useMemo(() => [...new Set([homeCurrency, ...(cur?.people.map((p) => p.home_currency).filter((c): c is string => !!c) ?? [])])].filter((c) => c !== billCurrency).join(","), [homeCurrency, cur?.people, billCurrency]);
  useEffect(() => {
    if (!billCurrency || !homes) return;
    let alive = true;
    Promise.all(homes.split(",").map(async (c) => [c, (await fx.rate(billCurrency, c).catch(() => null))?.rate] as const)).then((rs) => { if (alive) setRates(Object.fromEntries(rs.filter((r) => r[1] != null) as [string, number][])); });
    return () => { alive = false; };
  }, [billCurrency, homes]);

  if (!user || !active || !bundle || !cur) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Bill not found" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  if (!activePass(entitlements, active.id, now)) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Split needs Atlas Premium Pass" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  const { bill, items, people, shares } = cur;
  const comp = computeBill(bill, items, people, shares);
  const money = (n: number, c = bill.currency) => formatMoney(n, c);
  const home = (n: number, c: string | null) => (c && c !== bill.currency && rates[c] ? formatMoney(convert(n, rates[c]!, c), c) : null);
  const total = billTotal(bill, items);
  const settled = bill.status === "settled";
  const flagged = items.filter((i) => i.confidence != null && i.confidence < 0.7).length;

  const toInput = (over: Partial<BillInput> = {}): Omit<BillInput, "tripId"> => ({
    billId: bill.id, placeId: bill.place_id, merchant: bill.merchant, currency: bill.currency, status: bill.status, billDate: bill.bill_date,
    taxAmount: bill.tax_amount, taxLabel: bill.tax_label, serviceAmount: bill.service_amount, discountAmount: bill.discount_amount, roundingUnit: bill.rounding_unit, taxMode: bill.tax_mode, paidBy: bill.paid_by,
    items: items.map((i) => ({ id: i.id, name: i.name, localName: i.local_name, qty: i.qty, unitPrice: i.unit_price, confidence: i.confidence })),
    participants: people.map((p) => ({ id: p.id, travelerId: p.traveler_id, name: p.name, color: p.color, homeCurrency: p.home_currency })),
    shares: shares.map((x) => ({ itemId: x.item_id, participantId: x.participant_id })), ...over,
  });
  const save = async (over: Partial<BillInput>, then?: () => void, message?: string) => {
    setBusy(true);
    const r = await saveBill(toInput(over));
    setBusy(false);
    if ("error" in r) { setStatus({ error: r.error }); announce(r.error); return; }
    setEdits(null); // the refreshed bundle is the truth again
    if (message) { setStatus({ ok: message }); announce(message); }
    then?.();
  };
  const updateItem = (iid: string, patch: Partial<BillItemRow>) => set({ items: items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) });
  const addItem = () => {
    const price = Number(addDraft.price.replace(/[^\d.]/g, ""));
    if (!addDraft.name.trim() || !Number.isFinite(price)) return;
    const iid = crypto.randomUUID();
    set({ items: [...items, { id: iid, bill_id: bill.id, trip_id: bill.trip_id, name: addDraft.name.trim(), local_name: null, qty: addDraft.qty, unit_price: price, confidence: null, sort_order: items.length, created_at: new Date().toISOString() }], shares: [...shares, ...addDraft.who.map((participant_id) => ({ item_id: iid, participant_id, bill_id: bill.id, trip_id: bill.trip_id }))] });
    const ok = `Added ${addDraft.name.trim()} · ${money(price * addDraft.qty)}${addDraft.who.length ? ` · ${addDraft.who.map((w) => people.find((p) => p.id === w)?.name).join(" & ")}` : ""}.`;
    setStatus({ ok }); announce(ok); setAddOpen(false); setAddDraft({ name: "", price: "", qty: 1, who: [] });
  };
  const translateNames = async () => {
    const from = languageByCode(active.local_language)?.code ?? "en", to = languageByCode(user.profile.locale)?.code ?? "en";
    const out = await Promise.all(items.map(async (i) => { if (!i.local_name) return i; const r = await translation.translate(i.local_name, from, to); return r.approximate ? i : { ...i, name: r.text }; }));
    set({ items: out }); announce("Item names translated.");
  };
  const sendLink = async (p: BillParticipantRow) => {
    setBusy(true);
    const saved = await saveBill(toInput({ status: bill.status === "draft" ? "open" : bill.status }));
    if ("error" in saved) { setBusy(false); setStatus({ error: saved.error }); return; }
    const r = await claimLink(bill.id, p.id);
    setBusy(false); setEdits(null);
    if ("error" in r) { setStatus({ error: r.error }); return; }
    try { const res = await Share.share({ message: `${p.name}, pick what you ordered at ${bill.merchant}: ${r.url}` }); const ok = res.action === Share.sharedAction ? `Link sent to ${p.name}.` : `Claim link for ${p.name}: ${r.url}`; setStatus({ ok }); announce(ok); } catch { setStatus({ ok: `Claim link for ${p.name}: ${r.url}` }); }
  };
  const shareSummary = async () => {
    const text = billShareText(bill, comp, rates[homeCurrency] ? { home: { currency: homeCurrency, rate: rates[homeCurrency]! } } : {});
    try { await Share.share({ message: text }); } catch { /* cancelled */ }
  };
  // Holders get the amber ring (mockup 8a); gifted access shows the ring too, without the badge.
  const markOf = (p: BillParticipantRow) => markForUser(bundle.passMarks, bundle.travelers.find((x) => x.id === p.traveler_id)?.user_id);
  const avatar = (p: BillParticipantRow, size = 32, on = true) => { const mark = on ? markOf(p) : null; return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: on ? p.color : t.surface, borderWidth: on ? (mark ? 2 : 0) : 2, borderColor: mark ? t.premium : t.borderStrong, alignItems: "center", justifyContent: "center" }}><Text style={{ color: on ? "#fff" : t.textMuted, fontSize: Math.round(size * 0.38), fontFamily: t.font.bold }}>{initial(p.name)}</Text></View>; };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Split" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>Step {step} of 3 · {STEP_TITLE[step]}</Text><Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 24, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.4 }}>{bill.merchant}</Text></View>
          <Chip tone={settled ? "plain" : "premium"}>{settled ? "Settled" : "Atlas"}</Chip>
        </View>
        <View accessibilityRole="tablist" accessibilityLabel="Steps" style={{ flexDirection: "row", gap: 6 }}>
          {([1, 2, 3] as Step[]).map((n) => <Pressable key={n} accessibilityRole="tab" accessibilityLabel={n === 1 ? "Items" : n === 2 ? "Assign" : "Results"} accessibilityState={{ selected: step === n }} onPress={() => setStep(n)} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: step === n ? t.primary : t.surfaceTint, justifyContent: "center" }}><Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: step === n ? t.onPrimary : t.onTint }}>{n} · {n === 1 ? "Items" : n === 2 ? "Assign" : "Results"}</Text></Pressable>)}
        </View>
        {status.error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{status.error}</Text> : null}
        {status.ok ? <Text accessibilityLiveRegion="polite" style={{ color: t.primary, fontSize: 13, fontFamily: t.font.semibold }}>{status.ok}</Text> : null}

        {step === 1 && (
          <>
            {flagged > 0 && <Text style={{ backgroundColor: t.premiumBg, color: t.premiumText, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontFamily: t.font.semibold }}>{flagged === 1 ? "1 line looks uncertain." : `${flagged} lines look uncertain.`} Tap a value to fix it.</Text>}
            {items.map((i) => (
              <Card key={i.id} style={{ padding: 12, gap: 8, borderColor: i.confidence != null && i.confidence < 0.7 ? t.premium : t.border }}>
                {i.local_name ? <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }} accessibilityLanguage={active.local_language ?? undefined}>{i.local_name}{i.confidence != null && i.confidence < 0.7 ? ` · low confidence · read as "${i.local_name}"` : ""}</Text> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput accessibilityLabel="Item name" value={i.name} editable={!settled} onChangeText={(v) => updateItem(i.id, { name: v.slice(0, 120) })} style={{ flex: 1, fontSize: 15, fontFamily: t.font.bold, color: t.text, paddingVertical: 4 }} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${i.name}`} disabled={settled || items.length === 1} onPress={() => set({ items: items.filter((x) => x.id !== i.id), shares: shares.filter((x) => x.item_id !== i.id) })} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: settled || items.length === 1 ? 0.4 : 1 }}><Ionicons name="trash-outline" size={16} color={t.textMuted} /></Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <View accessibilityLabel={`Quantity of ${i.name}`} style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.borderStrong, borderRadius: 18 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Fewer" disabled={settled || i.qty <= 1} onPress={() => updateItem(i.id, { qty: i.qty - 1 })} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="remove" size={14} color={t.text} /></Pressable>
                    <Text style={{ minWidth: 32, textAlign: "center", fontSize: 13, fontFamily: t.font.bold, color: t.text }}>×{i.qty}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="More" disabled={settled || i.qty >= 99} onPress={() => updateItem(i.id, { qty: i.qty + 1 })} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={14} color={t.text} /></Pressable>
                  </View>
                  <TextInput accessibilityLabel={`Unit price of ${i.name} in ${bill.currency}`} value={String(i.unit_price)} editable={!settled} keyboardType="decimal-pad" onChangeText={(v) => updateItem(i.id, { unit_price: Number(v.replace(/[^\d.]/g, "")) || 0 })} style={{ width: 96, textAlign: "right", borderWidth: 1, borderColor: t.borderStrong, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, fontFamily: t.font.bold, color: t.text }} />
                  <Text style={{ fontSize: 15, fontFamily: t.font.extrabold, color: t.text }}>{money(i.qty * i.unit_price)}</Text>
                </View>
              </Card>
            ))}
            {!settled && <Button variant="secondary" label="Add missing line" icon={<Ionicons name="add" size={16} color={t.text} />} onPress={() => setAddOpen(true)} />}
            <Card>
              {[["Subtotal", money(comp.subtotal)], [bill.tax_label ?? "Tax", money(bill.tax_amount)], ["Service / tip", bill.service_amount ? money(bill.service_amount) : "None"], ...(bill.discount_amount ? [["Discount", `− ${money(bill.discount_amount)}`]] : [])].map(([l, v]) => <View key={l} accessible accessibilityLabel={`${l} ${v}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.border }}><Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.textMuted }}>{l}</Text><Text style={{ fontSize: 14, fontFamily: t.font.bold, color: t.text }}>{v}</Text></View>)}
              <View accessible accessibilityLabel={`Total ${money(total)}${home(total, homeCurrency) ? `, about ${home(total, homeCurrency)}` : ""}`} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}><Text style={{ fontSize: 15, fontFamily: t.font.extrabold, color: t.text }}>Total</Text><View style={{ alignItems: "flex-end" }}><Text style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>{money(total)}</Text>{home(total, homeCurrency) ? <Text style={{ fontSize: 12, color: t.textMuted }}>≈ {home(total, homeCurrency)}</Text> : null}</View></View>
            </Card>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button variant="secondary" label="Translate" icon={<Ionicons name="language-outline" size={16} color={t.text} />} onPress={translateNames} disabled={!items.some((i) => i.local_name)} />
              <Button size="cta" label="Looks right · Add people" style={{ flex: 1 }} disabled={busy} onPress={() => save({ status: settled ? "settled" : "open" }, () => setStep(2), "Items saved.")} />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <View accessibilityRole="radiogroup" accessibilityLabel="People" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {people.map((p) => <Pressable key={p.id} accessibilityRole="radio" accessibilityLabel={`${p.name}${p.claim_status === "claimed" ? ", claimed" : ""}`} accessibilityState={{ checked: selected === p.id }} onPress={() => setSelected(p.id)} style={{ height: 40, paddingRight: 14, paddingLeft: 4, borderRadius: 20, borderWidth: 1, borderColor: selected === p.id ? t.primary : t.borderStrong, backgroundColor: selected === p.id ? t.primary : t.surface, flexDirection: "row", alignItems: "center", gap: 8 }}>{avatar(p, 30)}<Text style={{ fontSize: 13, fontFamily: t.font.bold, color: selected === p.id ? t.onPrimary : t.text }}>{p.name}</Text></Pressable>)}
              {!settled && <Button variant="secondary" size="sm" label="Guest" icon={<Ionicons name="person-add-outline" size={16} color={t.text} />} onPress={() => { const gid = crypto.randomUUID(); set({ people: [...people, { id: gid, bill_id: bill.id, trip_id: bill.trip_id, traveler_id: null, name: `Guest ${people.length - bundle.travelers.length + 1}`, color: "#2B8C8C", home_currency: null, claim_token: null, claim_status: "none", claim_expires_at: "", created_at: new Date().toISOString() }] }); setSelected(gid); announce("Guest added to this bill only. Tap Edit to name them."); }} />}
              {!settled && selected && <Button variant="secondary" size="sm" label="Send link" icon={<Ionicons name="link-outline" size={16} color={t.text} />} disabled={busy} onPress={() => { const p = people.find((x) => x.id === selected); if (p) void sendLink(p); }} />}
            </View>
            <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>Tap avatars on each item. {people.find((p) => p.id === selected)?.name ?? "Someone"} is selected — tap items to claim them.</Text>
            {items.map((i) => {
              const who = people.filter((p) => shares.some((x) => x.item_id === i.id && x.participant_id === p.id));
              const each = who.length ? (i.qty * i.unit_price) / who.length : null;
              return (
                <Card key={i.id} style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${i.name}: ${who.length ? `shared by ${who.map((w) => w.name).join(", ")}` : "unassigned"}${selected ? `. Toggle for ${people.find((p) => p.id === selected)?.name}` : ""}`} disabled={settled || !selected} onPress={() => selected && set({ shares: toggleShare(shares, bill, i.id, selected) })} style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{i.name}</Text>
                    <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{who.length > 1 ? `Shared by ${who.length} · ${money(each!)} each` : who.length === 1 ? (i.qty > 1 ? `×${i.qty} · ${money(i.unit_price)} each` : `Just ${who[0]!.name}`) : "Unassigned"}</Text>
                  </Pressable>
                  <View accessibilityLabel={`Who had ${i.name}`} style={{ flexDirection: "row", gap: 4 }}>
                    {people.map((p) => { const on = who.some((w) => w.id === p.id); return <Pressable key={p.id} accessibilityRole="checkbox" accessibilityLabel={p.name} accessibilityState={{ checked: on }} disabled={settled} onPress={() => set({ shares: toggleShare(shares, bill, i.id, p.id) })}>{avatar(p, 30, on)}</Pressable>; })}
                  </View>
                  <Text style={{ width: 64, textAlign: "right", fontSize: 14, fontFamily: t.font.extrabold, color: t.text }}>{money(i.qty * i.unit_price)}</Text>
                </Card>
              );
            })}
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <Button variant="secondary" size="sm" label="Split rest evenly" disabled={settled || comp.unassigned === 0} onPress={() => set({ shares: splitRestEvenly(bill, items, people, shares) })} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Switch accessibilityLabel="Everyone shares tax evenly" value={bill.tax_mode === "even"} disabled={settled} onValueChange={(v) => set({ bill: { ...bill, tax_mode: v ? "even" : "proportional" } })} trackColor={{ true: t.primary, false: t.borderStrong }} /><Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: t.textMuted }}>Everyone shares tax {bill.tax_mode === "even" ? "evenly" : "in proportion"}</Text></View>
            </View>
            <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`Assigned ${money(comp.assigned)}, ${money(comp.unassigned)} left`}><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>Assigned</Text><Text style={{ fontSize: 17, fontFamily: t.font.extrabold, color: t.text }}>{money(comp.assigned)} · {money(comp.unassigned)} left</Text></View>
              <Button size="cta" label="Calculate" disabled={busy} onPress={() => save({ status: settled ? "settled" : "open" }, () => setStep(3), "Shares saved.")} />
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ fontSize: 20, fontFamily: t.font.extrabold, color: t.text }}>Everyone&apos;s share</Text><Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>{bill.tax_label ?? "Tax"} {bill.tax_mode === "even" ? "shared evenly" : "shared in proportion"} · rounded to {money(bill.rounding_unit)}</Text></View>
              <Button variant="secondary" size="sm" label="Share" icon={<Ionicons name="share-outline" size={16} color={t.text} />} onPress={shareSummary} />
            </View>
            <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }} accessible accessibilityLabel={`Bill total ${money(comp.total)}${home(comp.total, homeCurrency) ? `, about ${home(comp.total, homeCurrency)}` : ""}`}>
              <View><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>Bill total</Text><Text style={{ fontSize: 24, fontFamily: t.font.extrabold, color: t.text }}>{money(comp.total)}</Text></View>
              {home(comp.total, homeCurrency) ? <Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.textMuted }}>≈ {home(comp.total, homeCurrency)}</Text> : null}
            </Card>
            {comp.unassigned > 0 && <Text style={{ backgroundColor: t.premiumBg, color: t.premiumText, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontFamily: t.font.semibold }}>{money(comp.unassigned)} is still unassigned ({comp.unassignedItems.map((i) => i.name).join(", ")}). It isn&apos;t in anyone&apos;s share yet.</Text>}
            {comp.participants.map((pt) => {
              const p = pt.participant, isPayer = p.id === comp.payerId;
              const h = home(pt.total, p.home_currency) ?? (p.home_currency !== homeCurrency ? home(pt.total, homeCurrency) : null);
              return (
                <Card key={p.id} style={{ padding: 14, gap: 8 }} accessible accessibilityLabel={`${p.name}: ${money(pt.total)}${h ? `, about ${h}` : ""}${isPayer ? ", paid" : ""}${p.claim_status === "claimed" ? ", claimed" : p.claim_status === "opened" ? ", link opened" : ""}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {avatar(p, 36)}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{p.name}</Text>{isPayer ? <Text style={{ fontSize: 12, color: t.textMuted }}>· you paid</Text> : null}{p.claim_status === "claimed" ? <Chip>Claimed</Chip> : p.claim_status === "opened" ? <Chip tone="plain">Link opened</Chip> : null}</View>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{isPayer && pt.collects > 0 ? `Collects ${money(pt.collects)} from ${comp.participants.length - 1} people` : pt.lines.map((l) => `${fractionLabel(l.fraction)}${fractionLabel(l.fraction) ? " " : ""}${l.label}`).concat(pt.tax ? ["tax"] : []).join(" · ")}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}><Text style={{ fontSize: 17, fontFamily: t.font.extrabold, color: t.text }}>{money(pt.total)}</Text>{h ? <Text style={{ fontSize: 12, color: t.textMuted }}>{h}</Text> : null}</View>
                  </View>
                  {isPayer && pt.lines.map((l) => <View key={l.itemId} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontSize: 12.5, color: t.textMuted }}>{fractionLabel(l.fraction)} {l.label}</Text><Text style={{ fontSize: 12.5, fontFamily: t.font.semibold, color: t.text }}>{money(l.amount)}</Text></View>)}
                  {isPayer && pt.tax > 0 ? <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontSize: 12.5, color: t.textMuted }}>Tax</Text><Text style={{ fontSize: 12.5, fontFamily: t.font.semibold, color: t.text }}>{money(pt.tax)}</Text></View> : null}
                </Card>
              );
            })}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button variant="secondary" size="sm" label={`Adjust rounding · ${money(bill.rounding_unit)}`} disabled={settled} onPress={() => { const opts = bill.currency === "JPY" || bill.currency === "KRW" ? [1, 10, 100] : [0.01, 0.05, 0.1, 1]; set({ bill: { ...bill, rounding_unit: opts[(opts.indexOf(bill.rounding_unit) + 1) % opts.length]! } }); }} />
              <Button variant="secondary" size="sm" label="Edit items" icon={<Ionicons name="pencil-outline" size={16} color={t.text} />} onPress={() => setStep(1)} />
            </View>
            {settled ? <Button variant="secondary" size="cta" label="Reopen bill" full disabled={busy} onPress={() => save({ status: "open" }, undefined, "Bill reopened.")} /> : <Button size="cta" label="Close bill" full disabled={busy} onPress={() => save({ status: "settled" }, undefined, "Bill closed. Everyone's share is final.")} />}
            <Button variant="ghost" size="sm" label="Delete bill" onPress={async () => { const r = await deleteBill(bill.id); if ("error" in r) setStatus({ error: r.error }); else router.replace("/split"); }} />
          </>
        )}
      </ScrollView>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Cancel" accessibilityRole="button" onPress={() => setAddOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>Add item by hand</Text>
          <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>No receipt, or the scanner missed a line.</Text>
          <TextInput accessibilityLabel="Item" value={addDraft.name} onChangeText={(v) => setAddDraft((d) => ({ ...d, name: v }))} placeholder="Edamame" placeholderTextColor={t.textFaint} maxLength={120} style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular, backgroundColor: t.surface }} />
          <TextInput accessibilityLabel={`Price (${bill.currency})`} value={addDraft.price} onChangeText={(v) => setAddDraft((d) => ({ ...d, price: v }))} placeholder="450" placeholderTextColor={t.textFaint} keyboardType="decimal-pad" style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular, backgroundColor: t.surface }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>Quantity</Text>
            <View accessibilityLabel="Quantity" style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.borderStrong, borderRadius: 18 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Fewer" onPress={() => setAddDraft((d) => ({ ...d, qty: Math.max(1, d.qty - 1) }))} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="remove" size={14} color={t.text} /></Pressable>
              <Text style={{ minWidth: 32, textAlign: "center", fontSize: 13, fontFamily: t.font.bold, color: t.text }}>×{addDraft.qty}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => setAddDraft((d) => ({ ...d, qty: Math.min(99, d.qty + 1) }))} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={14} color={t.text} /></Pressable>
            </View>
          </View>
          <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>Who had it</Text>
          <View accessibilityLabel="Who had it" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {people.map((p) => { const on = addDraft.who.includes(p.id); return <Pressable key={p.id} accessibilityRole="checkbox" accessibilityLabel={p.name} accessibilityState={{ checked: on }} onPress={() => setAddDraft((d) => ({ ...d, who: on ? d.who.filter((x) => x !== p.id) : [...d.who, p.id] }))} style={{ height: 36, paddingRight: 12, paddingLeft: 4, borderRadius: 18, borderWidth: 1, borderColor: on ? "transparent" : t.borderStrong, backgroundColor: on ? p.color : t.surface, flexDirection: "row", alignItems: "center", gap: 6 }}>{avatar(p, 28, true)}<Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: on ? "#fff" : t.text }}>{p.name}</Text></Pressable>; })}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" label="Cancel" style={{ flex: 1 }} onPress={() => setAddOpen(false)} />
            <Button label={`Add${addDraft.who.length ? ` · ${addDraft.who.map((w) => people.find((p) => p.id === w)?.name).join(" & ")}` : ""}`} style={{ flex: 1 }} onPress={addItem} disabled={!addDraft.name.trim() || !addDraft.price} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
