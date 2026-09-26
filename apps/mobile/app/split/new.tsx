import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { activePass, initial, languageByCode, parseReceipt, placeById, pluralize, type BillInput, type ParsedReceipt } from "@voya/core";
import { Button, Card, Chip, EmptyState, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { ocr, translation } from "@/lib/providers";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/**
 * Scan (mockup 5a): merchant and currency from the trip, the travelers already on the bill.
 * Photos are read by the OCR provider on the device and dropped; the lines become a draft bill.
 */
export default function ScanReceiptScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { place: qPlace, manual } = useLocalSearchParams<{ place?: string; manual?: string }>();
  const { user } = useSession();
  const { now, active, bundle, entitlements, saveBill } = useData();
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  if (!user || !active || !bundle) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  if (!activePass(entitlements, active.id, now)) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Split needs Atlas Premium Pass" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  const place = placeById(bundle, qPlace ?? null);
  const currency = active.local_currency ?? user.profile.home_currency;
  const people = bundle.travelers.map((x) => ({ id: x.id, travelerId: x.id, name: x.name.split(" ")[0]!, color: x.color, homeCurrency: x.home_currency ?? (x.user_id === user.id ? user.profile.home_currency : null) }));

  const create = async (scanned: (Omit<ParsedReceipt, "items"> & { items: { name: string; localName: string; qty: number; unitPrice: number; confidence: number }[] }) | null) => {
    const bill: Omit<BillInput, "tripId"> = {
      billId: null, placeId: place?.id ?? null, merchant: place?.name ?? scanned?.merchant ?? "Receipt", currency, status: "draft", billDate: null,
      taxAmount: scanned?.tax ?? 0, taxLabel: scanned?.taxLabel ?? null, serviceAmount: scanned?.service ?? 0, discountAmount: 0, roundingUnit: currency === "JPY" || currency === "KRW" ? 1 : 0.01, taxMode: "proportional", paidBy: people[0]?.id ?? null,
      items: scanned?.items.length ? scanned.items.map((i, n) => ({ id: `i${n}`, name: i.name, localName: i.localName, qty: i.qty, unitPrice: i.unitPrice, confidence: i.confidence })) : [{ id: "i0", name: "Item", localName: null, qty: 1, unitPrice: 0, confidence: null }],
      participants: people, shares: [],
    };
    const r = await saveBill(bill);
    if ("error" in r) { setStatus({ error: r.error }); announce(r.error); return; }
    router.replace({ pathname: "/split/[id]", params: { id: r.id } });
  };
  const scan = async (uris: string[], sample = false) => {
    setBusy(true); setStatus({}); announce("Reading the receipt…");
    try {
      const from = languageByCode(active.local_language)?.code ?? "en", to = languageByCode(user.profile.locale)?.code ?? "en";
      const lines = [];
      for (const uri of sample ? [null] : uris) {
        const bytes = uri ? await fetch(uri).then((r) => r.arrayBuffer()).catch(() => new ArrayBuffer(0)) : new ArrayBuffer(0);
        lines.push(...(await ocr.recognize(bytes, { languageHints: [from], document: "receipt" })));
      }
      const parsed = parseReceipt(lines);
      const items = await Promise.all(parsed.items.map(async (i) => { const tr = from === to ? { text: i.localName, approximate: false } : await translation.translate(i.localName, from, to); return { ...i, name: tr.approximate ? i.localName : tr.text }; }));
      const ok = `Read ${items.length} lines${parsed.flagged ? `, ${parsed.flagged} uncertain` : ""}. Opening the bill…`; setStatus({ ok }); announce(ok);
      await create({ ...parsed, items });
    } catch { setStatus({ error: "Couldn't read that receipt. Try a sharper photo with more light." }); } finally { setBusy(false); }
  };
  const pick = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setStatus({ error: camera ? "Camera permission was denied. Allow it in Settings to scan receipts." : "Photo access was denied. Allow it in Settings to choose a photo." }); return; }
      const res = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      const asset = res.canceled ? null : res.assets?.[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) { setStatus({ error: "Photos up to 8 MB, please." }); return; }
      setPages((p) => [...p, asset.uri].slice(0, 10));
    } catch { setStatus({ error: "Couldn't open the camera or photos on this device." }); }
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Split" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>Atlas Premium Pass · {active.name}</Text><Text accessibilityRole="header" style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>{manual ? "Enter by hand" : "Scan receipt"}</Text></View>
        </View>
        <Card style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>Merchant</Text><Text style={{ fontSize: 17, fontFamily: t.font.extrabold, color: t.text }}>{place?.name ?? "From the receipt"}</Text>{place ? <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>tonight&apos;s dinner · from your plan</Text> : null}</View>
            <Chip>Currency {currency}</Chip>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flexDirection: "row" }} accessible accessibilityRole="image" accessibilityLabel={people.map((p) => p.name).join(", ")}>{people.map((p, n) => <View key={p.id} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p.color, borderWidth: 2, borderColor: t.surface, marginLeft: n ? -8 : 0, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 11, fontFamily: t.font.bold }}>{initial(p.name)}</Text></View>)}</View>
            <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.textMuted }}>{pluralize(people.length, "person", "people")} from your trip</Text>
          </View>
        </Card>
        {!manual && (
          <View style={{ aspectRatio: 4 / 3, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: t.borderStrong, backgroundColor: t.mapBg, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.surfaceTint, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera-outline" size={26} color={t.primary} /></View>
            <Text style={{ fontSize: 16, fontFamily: t.font.bold, color: t.text, textAlign: "center" }}>{pages.length ? `${pages.length} page${pages.length > 1 ? "s" : ""} ready` : "Receipt detected · hold steady"}</Text>
            <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular, textAlign: "center" }}>Items, tax and tip are read from the photo. The photo is read once and never stored.</Text>
          </View>
        )}
        {status.ok ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.primary }}>{status.ok}</Text> : null}
        {status.error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{status.error}</Text> : null}
        {manual ? (
          <Button size="cta" label="Start with an empty bill" onPress={() => create(null)} disabled={busy} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button variant="secondary" label="Choose photo" icon={<Ionicons name="image-outline" size={18} color={t.text} />} style={{ flexGrow: 1, flexBasis: "45%" }} onPress={() => pick(false)} />
            <Button variant="ink" label="Snap" icon={<Ionicons name="camera-outline" size={18} color={t.onInk} />} style={{ flexGrow: 1, flexBasis: "45%" }} onPress={() => pick(true)} />
            <Button variant="secondary" label="Add another page" style={{ flexGrow: 1, flexBasis: "45%" }} disabled={!pages.length} onPress={() => pick(true)} />
            <Button variant="secondary" label="Try a sample receipt" icon={<Ionicons name="sparkles-outline" size={18} color={t.text} />} style={{ flexGrow: 1, flexBasis: "45%" }} disabled={busy} onPress={() => scan([], true)} />
            {pages.length > 0 && <Button size="cta" label={pages.length > 1 ? `Read ${pages.length} pages` : "Read the receipt"} full disabled={busy} onPress={() => scan(pages)} />}
            <Button variant="ghost" size="sm" label="Enter by hand instead" onPress={() => create(null)} disabled={busy} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
