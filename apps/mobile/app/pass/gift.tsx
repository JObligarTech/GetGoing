import { useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GIFT_DAYS, activePass, canGift, giftCandidates, giftStatusLabel, kindLabel } from "@voya/core";
import { Avatar, PassChip } from "@/components/pass";
import { Button, Card, EmptyState, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** Gift picker (mockup 8c): one traveler on this trip gets 3 days; the gift travels as a link. */
export default function GiftScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { now, active, bundle, entitlements, createGift } = useData();
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  if (!user || !active || !bundle) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  const pass = activePass(entitlements, active.id, now);
  const allowed = canGift(entitlements, active.id, bundle.passGifts, user.id, now);
  const candidates = giftCandidates(bundle.travelers, bundle.passMarks, user.id);
  const pick = candidates.find((c) => c.traveler.id === (chosen ?? candidates.find((c) => c.eligible)?.traveler.id)) ?? null;
  const first = pick?.traveler.name.split(" ")[0];
  const mine = bundle.passGifts.find((g) => g.giver_id === user.id && g.status !== "revoked");
  const site = process.env.EXPO_PUBLIC_SITE_URL ?? "https://voya.app";
  const share = async (url: string, name: string) => {
    try { const r = await Share.share({ message: `${name}, you've been gifted 3 days of Atlas Premium Pass on ${active.name}. Accept it here: ${url}` }); const m = r.action === Share.sharedAction ? `Gift link shared with ${name}.` : ""; setStatus(m); if (m) announce(m); } catch { setStatus("Couldn't open the share sheet."); }
  };
  const send = async () => {
    if (!pick || !first) return;
    setBusy(true); setError(null);
    const r = await createGift(pick.traveler.id);
    setBusy(false);
    if ("error" in r) { setError(r.error); announce(r.error); return; }
    await share(r.url, first);
  };
  const back = <Pressable accessibilityRole="button" accessibilityLabel="Back to Atlas Premium Pass" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>;
  const recipient = mine ? bundle.travelers.find((x) => x.id === mine.traveler_id)?.name.split(" ")[0] ?? "them" : "";

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{back}<View style={{ flex: 1 }}><PageHeader eyebrow={pass ? `Atlas Premium Pass · ${kindLabel(pass.kind)}` : "Atlas Premium Pass"} title={`Gift ${GIFT_DAYS} days`} action={<PassChip>{allowed.ok ? "1 gift available" : "Used"}</PassChip>} /></View></View>
        <Text style={{ fontSize: 14, color: t.textMuted, fontFamily: t.font.regular }}>Give a traveler on {active.name} full Atlas Premium Pass for {GIFT_DAYS} days. Resets with each new trip.</Text>
        {allowed.ok ? (
          <>
            <Card accessibilityRole="radiogroup" accessibilityLabel="Who gets it">
              {candidates.map((c, i) => {
                const on = c.traveler.id === pick?.traveler.id;
                return (
                  <Pressable key={c.traveler.id} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !c.eligible }} accessibilityLabel={`${c.traveler.name}, ${c.status}`} disabled={!c.eligible} onPress={() => setChosen(c.traveler.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: on ? t.surfaceTint : "transparent", opacity: c.eligible ? 1 : 0.6, borderBottomWidth: i === candidates.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                    <Avatar name={c.traveler.name} color={c.traveler.color} size={40} mark={c.eligible ? null : "pass"} />
                    <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>{c.traveler.name}</Text><Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{c.status}</Text></View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? t.primary : t.borderStrong, backgroundColor: on ? t.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{on && <Ionicons name="checkmark" size={14} color={t.onPrimary} />}</View>
                  </Pressable>
                );
              })}
            </Card>
            {pick && (
              <Card>
                {[["Starts", `When ${first} accepts`], ["Ends", `3 days later · midnight ${active.cities[0] ?? active.name}`], ["After that", `${first} can extend · $0.99 for up to 7 days`]].map(([k, v], i) => (
                  <View key={k} accessible accessibilityLabel={`${k}: ${v}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, padding: 14, borderBottomWidth: i === 2 ? 0 : 1, borderBottomColor: t.border }}><Text style={{ fontSize: 14, color: t.textMuted }}>{k}</Text><Text style={{ flex: 1, textAlign: "right", fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{v}</Text></View>
                ))}
              </Card>
            )}
            {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{error}</Text> : null}
            <Button size="cta" label={`Send gift${first ? ` to ${first}` : ""}`} icon={<Ionicons name="gift-outline" size={16} color={t.onPrimary} />} disabled={!pick || busy} onPress={send} />
          </>
        ) : mine ? (
          <Card style={{ padding: 20, alignItems: "center", gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.premiumBg, alignItems: "center", justifyContent: "center" }}><Ionicons name="gift-outline" size={22} color={t.premiumText} /></View>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontFamily: t.font.extrabold, color: t.text }}>Gift sent to {recipient}</Text>
            <Text style={{ fontSize: 13, color: t.textMuted, textAlign: "center", fontFamily: t.font.regular }}>{giftStatusLabel(mine, recipient, now)}. It starts when {recipient} accepts and ends 3 days later at midnight, trip time. The link works for 30 days.</Text>
            <Text selectable style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{`${site}/gift/${mine.code}`}</Text>
            {status ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.primary }}>{status}</Text> : null}
            <Button variant="secondary" label="Share the link again" icon={<Ionicons name="link-outline" size={16} color={t.text} />} onPress={() => share(`${site}/gift/${mine.code}`, recipient)} />
            <Button variant="ghost" label="Back to Split" onPress={() => router.replace("/split")} />
          </Card>
        ) : (
          <Text accessibilityLiveRegion="polite" style={{ backgroundColor: t.surfaceTint, color: t.onTint, borderRadius: 12, padding: 12, fontSize: 13, fontFamily: t.font.semibold }}>{allowed.reason}</Text>
        )}
      </ScrollView>
    </View>
  );
}
