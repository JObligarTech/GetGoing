import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatEnds, giftCodeSchema } from "@voya/core";
import { Avatar, PassStar } from "@/components/pass";
import { Button, Card, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData, type GiftPreview } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/**
 * Redeem a gift (mockup 8c, recipient): paste the code (or arrive by link with ?code=), see who
 * sent it and when it ends, accept. No card, nothing renews.
 */
export default function RedeemScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { code: qCode } = useLocalSearchParams<{ code?: string }>();
  const { user } = useSession();
  const { giftPreview, redeemGift } = useData();
  const [code, setCode] = useState(qCode ?? "");
  const [preview, setPreview] = useState<{ key: string; value: GiftPreview | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = giftCodeSchema.safeParse(code);
  const key = valid.success ? valid.data : null;
  useEffect(() => {
    if (!key) return;
    let alive = true;
    giftPreview(key).then((value) => { if (alive) setPreview({ key, value }); });
    return () => { alive = false; };
  }, [key, giftPreview]);
  const p = preview?.key === key ? preview.value : null;
  const accept = async () => {
    if (!key) return;
    setBusy(true); setError(null);
    const r = await redeemGift(key);
    setBusy(false);
    if ("error" in r) { setError(r.error); announce(r.error); return; }
    router.replace({ pathname: "/pass/done", params: { e: r.id } });
  };
  const first = user?.profile.display_name.split(" ")[0] ?? "you";
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}><PageHeader eyebrow="Atlas Premium Pass" title="Redeem a gift" /></View>
        </View>
        <Card style={{ padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Paste the code from the link a traveler sent you. It&apos;s the last part of the link, 24 letters and numbers.</Text>
          <TextInput accessibilityLabel="Gift code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="24-character code" placeholderTextColor={t.textFaint} style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, paddingHorizontal: 14, fontSize: 15, color: t.text, fontFamily: t.font.medium }} />
          {code.length > 0 && !key ? <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>Keep typing: a code is 24 letters and numbers.</Text> : null}
          {key && preview?.key === key && !p ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>Gift not found. Check the link or ask for a new one.</Text> : null}
        </Card>
        {p && (p.status !== "sent" || p.expired) && (
          <Card style={{ padding: 16, gap: 6 }}>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontFamily: t.font.extrabold, color: t.text }}>{p.status === "accepted" ? "This gift was already accepted" : "This gift isn't active"}</Text>
            <Text style={{ fontSize: 14, color: t.textMuted, fontFamily: t.font.regular }}>Gift links last 30 days and work once. Ask the person who sent it for a new one, or get your own pass.</Text>
          </Card>
        )}
        {p && p.status === "sent" && !p.expired && (
          <>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Avatar name={p.giver_name} size={64} mark="pass" label={`${p.giver_name}, Atlas Premium Pass`} />
              <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.textMuted }}>A gift from {p.giver_name}</Text>
              <Text accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5, textAlign: "center" }}>{p.days} days of Atlas Premium Pass</Text>
              <Text style={{ fontSize: 14, color: t.textMuted, textAlign: "center", fontFamily: t.font.regular }}>For {p.trip_name}. Split, Navigate trees, Translate and Currency unlock the moment you accept.</Text>
            </View>
            <Card>
              {[["Access", `Full Atlas Premium Pass · ${p.days} days`], ["Ends", `${formatEnds(new Date(p.ends_preview), p.trip_tz ?? "UTC")} if accepted today`], ["Need longer?", "Extend up to 7 days · $0.99"]].map(([k, v], i) => (
                <View key={k} accessible accessibilityLabel={`${k}: ${v}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, padding: 14, borderBottomWidth: i === 2 ? 0 : 1, borderBottomColor: t.border }}><Text style={{ fontSize: 14, color: t.textMuted }}>{k}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>{i === 0 && <PassStar size={12} />}<Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.text, textAlign: "right" }}>{v}</Text></View></View>
              ))}
            </Card>
            <Text style={{ textAlign: "center", fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>No card needed to accept. Nothing renews.</Text>
            {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{error}</Text> : null}
            <Button size="cta" label={`Accept gift as ${first}`} disabled={busy} onPress={accept} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
