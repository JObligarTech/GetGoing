import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PASS_PLANS, PAYMENT_METHOD_LABEL, activePass, canGift, endedPass, giftStatusLabel, kindLabel, passSummary, planBlurb, type PassPlanId, type PaymentMethod } from "@voya/core";
import { PassChip, PassStar } from "@/components/pass";
import { Button, Card, Chip, Eyebrow, IconCoin, ListRow, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { isDemo } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const METHODS: PaymentMethod[] = ["apple_pay", "google_pay", "card"];

/** Checkout (mockup 7a) when there's no pass; the pass, gifting and receipts when there is. */
export default function PassScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan: qPlan } = useLocalSearchParams<{ plan?: string }>();
  const { user } = useSession();
  const { now, active, bundle, entitlements, purchase } = useData();
  const [plan, setPlan] = useState<PassPlanId>(qPlan === "trip" || qPlan === "monthly" ? qPlan : "yearly");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const pass = activePass(entitlements, active?.id ?? null, now);
  const ended = endedPass(entitlements, active?.id ?? null, now);
  const tz = active?.local_tz ?? user.profile.home_tz;
  const back = <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>;

  if (!pass) {
    const chosen = PASS_PLANS.find((p) => p.id === plan)!;
    const pay = async () => {
      setBusy(true); setError(null);
      const r = await purchase(plan, method);
      setBusy(false);
      if ("error" in r) { setError(r.error); announce(r.error); return; }
      router.replace({ pathname: "/pass/done", params: { e: r.id } });
    };
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{back}<View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{active ? `${active.name} · Tools` : "Tools"}</Text><Text accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>Choose your Atlas Premium Pass</Text></View></View>
          {ended && <Text accessibilityLiveRegion="polite" style={{ backgroundColor: t.surfaceTint, color: t.onTint, borderRadius: 12, padding: 12, fontSize: 13, fontFamily: t.font.semibold }}>Your {kindLabel(ended.kind).toLowerCase()} pass ended. Your bills stay readable and shareable.</Text>}
          <View accessibilityRole="radiogroup" accessibilityLabel="Plan" style={{ gap: 10 }}>
            {PASS_PLANS.map((p) => {
              const on = p.id === plan;
              const disabled = p.id === "trip" && !active;
              return (
                <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} accessibilityLabel={`${p.label}${p.id === "trip" && active ? ` · ${active.name}` : ""}, $${p.price} ${p.period}`} disabled={disabled} onPress={() => setPlan(p.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: on ? t.primary : t.border, backgroundColor: on ? t.surfaceTint : t.surface, opacity: disabled ? 0.5 : 1 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? t.primary : t.borderStrong, backgroundColor: on ? t.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{on && <Ionicons name="checkmark" size={14} color={t.onPrimary} />}</View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Text style={{ fontSize: 16, fontFamily: t.font.extrabold, color: t.text }}>{p.label}</Text>{p.id === "trip" && active ? <Text style={{ fontSize: 14, color: t.textMuted, fontFamily: t.font.semibold }}>· {active.name}</Text> : null}{p.save ? <Chip tone="premium">{p.save.toUpperCase()}</Chip> : null}</View>
                    <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>{planBlurb(p.id, active)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}><Text style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>${p.price}</Text><Text style={{ fontSize: 11.5, color: t.textMuted, fontFamily: t.font.regular }}>{p.period}</Text></View>
                </Pressable>
              );
            })}
          </View>
          <Card style={{ padding: 14, gap: 12 }}>
            <Eyebrow>Pay with</Eyebrow>
            <View accessibilityRole="radiogroup" accessibilityLabel="Pay with" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {METHODS.map((m) => <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: method === m }} accessibilityLabel={PAYMENT_METHOD_LABEL[m]} onPress={() => setMethod(m)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: method === m ? t.primary : t.borderStrong, backgroundColor: method === m ? t.surfaceTint : t.surface, justifyContent: "center" }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: method === m ? t.onTint : t.text }}>{PAYMENT_METHOD_LABEL[m]}</Text></Pressable>)}
            </View>
            {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{error}</Text> : null}
            <Button size="cta" label={`Pay · $${chosen.price}`} icon={<PassStar size={14} color={t.onPrimary} />} disabled={busy} onPress={pay} />
            <Text style={{ textAlign: "center", fontSize: 11.5, color: t.textMuted, fontFamily: t.font.regular, lineHeight: 16 }}>{isDemo ? "Demo: nothing is charged. " : "Billed through the App Store. "}Single-trip passes end automatically. Monthly and yearly renew until cancelled in your store subscriptions.</Text>
          </Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Button variant="ghost" size="sm" label="Redeem a gift" icon={<Ionicons name="gift-outline" size={16} color={t.primary} />} onPress={() => router.push("/pass/redeem")} />
            <Button variant="ghost" size="sm" label="Restore purchase" onPress={() => announce("Nothing to restore for this account.")} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const summary = passSummary(pass, now, tz);
  const isGifted = pass.kind === "gift" || pass.kind === "extension";
  const gifting = active && bundle ? canGift(entitlements, active.id, bundle.passGifts, user.id, now) : { ok: false as const, reason: "Pick a trip first." };
  const myGifts = bundle?.passGifts.filter((g) => g.giver_id === user.id) ?? [];
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{back}<View style={{ flex: 1 }}><PageHeader eyebrow="Account" title="Atlas Premium Pass" action={<PassChip mark={isGifted ? "gifted" : "pass"}>{isGifted ? "Gifted" : undefined}</PassChip>} /></View></View>
        <Card style={{ padding: 14, gap: 4 }} accessible accessibilityLabel={`${summary.title}. ${summary.detail}.`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><PassStar size={16} /><Text style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>{summary.title}</Text></View>
          <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>{summary.detail}{pass.paid_with ? ` · paid with ${pass.paid_with}` : ""}</Text>
          <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Split, Navigate trees, Translate and Currency are unlocked{pass.trip_id ? ` on ${active?.name ?? "this trip"}` : " on every trip"}.</Text>
        </Card>
        {isGifted && active && (
          <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>Need longer?</Text><Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>Extend up to 7 days for $0.99, or get the full single-trip pass for $2.99.</Text></View>
            <Button size="sm" label="Extend" onPress={() => router.push("/pass/extend")} />
          </Card>
        )}
        {(pass.kind === "monthly" || pass.kind === "yearly") && (
          <>
            <Eyebrow>Gifting</Eyebrow>
            <Card>
              {gifting.ok
                ? <ListRow onPress={() => router.push("/pass/gift")} leading={<IconCoin name="gift-outline" />} title="Gift 3 days" subtitle={`1 gift available on ${active?.name}. Resets with each new trip.`} chevron last={myGifts.length === 0} />
                : <ListRow leading={<IconCoin name="gift-outline" />} title="Gift 3 days" subtitle={gifting.reason} last={myGifts.length === 0} />}
              {myGifts.map((g, i) => <ListRow key={g.id} title={giftStatusLabel(g, bundle?.travelers.find((x) => x.id === g.traveler_id)?.name.split(" ")[0] ?? "them", now)} last={i === myGifts.length - 1} />)}
            </Card>
          </>
        )}
        <Eyebrow>Receipts</Eyebrow>
        <Card>
          {entitlements.map((e, i) => <ListRow key={e.id} leading={<IconCoin name="receipt-outline" />} title={`${kindLabel(e.kind)}${e.amount != null ? ` · $${e.amount.toFixed(2)}` : " · free"}`} subtitle={`${new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${e.paid_with ? ` · ${e.paid_with}` : ""}`} last={i === entitlements.length - 1} />)}
        </Card>
        <Button variant="ghost" size="sm" label="Redeem a gift" icon={<Ionicons name="gift-outline" size={16} color={t.primary} />} onPress={() => router.push("/pass/redeem")} />
      </ScrollView>
    </View>
  );
}
