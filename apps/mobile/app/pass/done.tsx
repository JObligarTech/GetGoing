import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatEnds, kindLabel } from "@voya/core";
import { Avatar, PassStar } from "@/components/pass";
import { Button, Card, EmptyState, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const fmt = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" });

/** Pass active confirmation (mockup 7a): what was bought, how it was paid, the mark on the avatar. */
export default function PassDoneScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { e } = useLocalSearchParams<{ e?: string }>();
  const { user } = useSession();
  const { active, entitlements } = useData();
  const pass = entitlements.find((x) => x.id === e);
  if (!user || !pass) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No pass to show" action={<Button label="Atlas Premium Pass" variant="secondary" onPress={() => router.replace("/pass")} />} /></View></View>;
  const tz = active?.local_tz ?? user.profile.home_tz;
  const first = user.profile.display_name.split(" ")[0];
  const gifted = pass.kind === "gift" || pass.kind === "extension";
  const renews = pass.kind === "monthly" || pass.kind === "yearly";
  const line = renews ? `${kindLabel(pass.kind)} · renews ${fmt(pass.ends_at, tz)}.` : pass.kind === "trip" ? `${kindLabel(pass.kind)} · ${active?.name ?? "your trip"} · ends ${fmt(new Date(new Date(pass.ends_at).getTime() - 60_000).toISOString(), tz)}.` : `${kindLabel(pass.kind)} · ends ${formatEnds(new Date(pass.ends_at), tz)}.`;
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ alignItems: "flex-end" }}><Button variant="ghost" size="sm" label="Done" onPress={() => router.replace(pass.kind === "trip" || gifted ? "/split" : "/(tabs)")} /></View>
        <View accessible accessibilityRole="header" accessibilityLabel={`${gifted ? "Gift accepted" : "Congratulations"}, ${first}. You have Atlas Premium Pass. ${line}`} style={{ backgroundColor: t.ink, borderRadius: 20, padding: 24, alignItems: "center", gap: 10 }}>
          <Avatar name={user.profile.display_name} size={72} mark={gifted ? "gifted" : "pass"} />
          <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.onInk, opacity: 0.8 }}>{gifted ? "Gift accepted" : "Congratulations"}, {first}</Text>
          <Text style={{ fontSize: 26, lineHeight: 32, fontFamily: t.font.extrabold, color: t.onInk, letterSpacing: -0.5, textAlign: "center" }}>You have Atlas Premium Pass</Text>
          <Text style={{ fontSize: 14, color: t.onInk, opacity: 0.9, textAlign: "center" }}>{line}</Text>
          <Text style={{ fontSize: 13, color: t.onInk, opacity: 0.8, textAlign: "center" }}>Split, Navigate trees, Translate and Currency are unlocked {pass.trip_id ? `on ${active?.name ?? "this trip"}` : "on every trip"}.</Text>
        </View>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: t.border }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><PassStar size={14} /><Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>Atlas Premium Pass · {kindLabel(pass.kind).toLowerCase()}</Text></View><Text style={{ fontSize: 15, fontFamily: t.font.extrabold, color: t.text }}>{pass.amount != null ? `$${pass.amount.toFixed(2)}` : "Free"}</Text></View>
          {pass.paid_with ? <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: t.border }}><Text style={{ fontSize: 14, color: t.textMuted }}>Paid with</Text><Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{pass.paid_with}</Text></View> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 14 }}><Text style={{ fontSize: 14, color: t.textMuted }}>Receipt</Text><Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{pass.amount ? `Sent to ${user.email}` : "Nothing to pay"}</Text></View>
        </Card>
        <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Your avatar now carries the Atlas mark so travelers know who can split{gifted ? "" : ", gift"} and build trees.</Text>
        <Button size="cta" label="Scan tonight's receipt" onPress={() => router.replace("/split/new")} />
      </ScrollView>
    </View>
  );
}
