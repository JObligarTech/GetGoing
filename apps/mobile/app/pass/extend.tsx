import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EXTENSION_MAX_DAYS, EXTENSION_PRICE, PAYMENT_METHOD_LABEL, daysLeft, extensionCoverage, formatEnds, type PaymentMethod } from "@voya/core";
import { PassChip } from "@/components/pass";
import { Button, Card, EmptyState, Eyebrow, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { isDemo } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const METHODS: PaymentMethod[] = ["apple_pay", "google_pay", "card"];

/** Extend a gifted pass (mockup 8c): 1–7 days, same price for any length, one-time. */
export default function ExtendScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { now, active, entitlements, extend } = useData();
  const [days, setDays] = useState(EXTENSION_MAX_DAYS);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gifted = active ? entitlements.filter((e) => e.trip_id === active.id && (e.kind === "gift" || e.kind === "extension")).sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0] : null;
  if (!user || !active || !gifted) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Extensions are for gifted passes" body="Get a single-trip pass for the whole trip instead." action={<Button label="Atlas Premium Pass" variant="secondary" onPress={() => router.replace("/pass")} />} /></View></View>;
  const tz = active.local_tz ?? user.profile.home_tz;
  const ends = new Date(gifted.ends_at);
  const left = daysLeft(gifted, now);
  const from = new Date(Math.max(ends.getTime(), now.getTime()));
  const coverage = extensionCoverage(from, days, active, tz);
  const pay = async () => {
    setBusy(true); setError(null);
    const r = await extend(days, method);
    setBusy(false);
    if ("error" in r) { setError(r.error); announce(r.error); return; }
    router.replace({ pathname: "/pass/done", params: { e: r.id } });
  };
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Split" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}><PageHeader eyebrow={`${active.name} · Tools`} title="Split" action={<PassChip mark="gifted">{left <= 1 ? "ends tonight" : `${left}d left`}</PassChip>} /></View>
        </View>
        <View style={{ backgroundColor: t.ink, borderRadius: 20, padding: 20, gap: 4 }} accessible accessibilityRole="header" accessibilityLabel={`${ends.getTime() > now.getTime() ? `Your gifted pass ends ${formatEnds(ends, tz)}` : "Your gifted pass has ended"}. Keep Atlas Premium Pass for the rest of the trip for $${EXTENSION_PRICE}.`}>
          <Text style={{ fontSize: 20, lineHeight: 26, fontFamily: t.font.extrabold, color: t.onInk, letterSpacing: -0.3 }}>{ends.getTime() > now.getTime() ? `Your gifted pass ends ${left <= 1 ? "at midnight" : formatEnds(ends, tz)}` : "Your gifted pass has ended"}</Text>
          <Text style={{ fontSize: 13.5, color: t.onInk, opacity: 0.85 }}>Keep Atlas Premium Pass for the rest of the trip for ${EXTENSION_PRICE}.</Text>
        </View>
        <Card style={{ padding: 14, gap: 12 }}>
          <Eyebrow>Extend by</Eyebrow>
          <View accessibilityRole="radiogroup" accessibilityLabel="Extend by" style={{ flexDirection: "row", gap: 6 }}>
            {Array.from({ length: EXTENSION_MAX_DAYS }, (_, i) => i + 1).map((d) => <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: days === d }} accessibilityLabel={`${d} day${d > 1 ? "s" : ""}`} onPress={() => setDays(d)} style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: days === d ? t.primary : t.borderStrong, backgroundColor: days === d ? t.primary : t.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 14, fontFamily: t.font.bold, color: days === d ? t.onPrimary : t.text }}>{d}d</Text></Pressable>)}
          </View>
          <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular, lineHeight: 18 }}>Same price for any length up to {EXTENSION_MAX_DAYS} days. {coverage.text}</Text>
        </Card>
        <Card style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}><Text style={{ fontSize: 15, fontFamily: t.font.bold, color: t.text }}>Extension · {days} day{days > 1 ? "s" : ""}</Text><Text style={{ fontSize: 22, fontFamily: t.font.extrabold, color: t.text }}>${EXTENSION_PRICE}</Text></View>
          <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>One-time, never renews</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Pay with" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {METHODS.map((m) => <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: method === m }} accessibilityLabel={PAYMENT_METHOD_LABEL[m]} onPress={() => setMethod(m)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: method === m ? t.primary : t.borderStrong, backgroundColor: method === m ? t.surfaceTint : t.surface, justifyContent: "center" }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: method === m ? t.onTint : t.text }}>{PAYMENT_METHOD_LABEL[m]}</Text></Pressable>)}
          </View>
          {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{error}</Text> : null}
          <Button size="cta" label={`Pay · $${EXTENSION_PRICE}`} disabled={busy} onPress={pay} />
          <Text style={{ textAlign: "center", fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{isDemo ? "Demo: nothing is charged. " : ""}Or get the full single-trip pass · $2.99 for the whole trip.</Text>
          <Button variant="ghost" size="sm" label="Get the single-trip pass instead" onPress={() => router.replace({ pathname: "/pass", params: { plan: "trip" } })} />
        </Card>
      </ScrollView>
    </View>
  );
}
