import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { activePass, billTotal, formatMoney, localDate, navShortcuts, PASS_PRICES, passLabel, pluralize, tripDayNumber } from "@voya/core";
import { Button, Card, Chip, EmptyState, Eyebrow, IconCoin, ListRow, PageHeader, Tile, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** Split hub: the Atlas Premium Pass gate when locked; otherwise start a bill and the trip's bills. */
export default function SplitHub() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { now, active, bundle, entitlements, pastBills } = useData();
  if (!user || !active || !bundle) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><PageHeader eyebrow="Split" title="No active trip" /><EmptyState title="Create a trip first" body="Split uses the travelers and currency already on your trip." /></View></View>;
  const pass = activePass(entitlements, active.id, now);
  const back = <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>;

  if (!pass) {
    const rows: [keyof typeof Ionicons.glyphMap, string][] = [["camera-outline", "Items, tax and tip read from a photo"], ["link-outline", "Friends claim what they ordered by link, no account"], ["wallet-outline", `Totals in ${active.local_currency ?? "the local currency"} and your home ${user.profile.home_currency}`]];
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{back}<View style={{ flex: 1 }}><PageHeader eyebrow={`${active.name} · Tools`} title="Split" action={<Chip tone="premium">Atlas</Chip>} /></View></View>
          <Card style={{ padding: 18, gap: 14 }}>
            <View style={{ alignSelf: "flex-start" }}><Chip tone="premium">Atlas Premium Pass</Chip></View>
            <Text accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.4 }}>Scan the receipt.{"\n"}Everyone pays their share.</Text>
            {rows.map(([icon, text]) => <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.premiumBg, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={18} color={t.premiumText} /></View><Text style={{ flex: 1, fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{text}</Text></View>)}
            <Button size="cta" label={`Get Atlas Premium Pass · from $${PASS_PRICES.trip.price}`} onPress={() => router.push("/(tabs)/profile")} />
            <Text style={{ textAlign: "center", fontSize: 12.5, fontFamily: t.font.semibold, color: t.textMuted }}>{PASS_PRICES.trip.label} ${PASS_PRICES.trip.price} · {PASS_PRICES.monthly.label} ${PASS_PRICES.monthly.price} · {PASS_PRICES.yearly.label} ${PASS_PRICES.yearly.price}</Text>
          </Card>
          <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <IconCoin name="gift-outline" />
            <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>Been gifted access?</Text><Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>Monthly and yearly members can gift one trip 3 days of Atlas Premium Pass. Extend for $0.99 if you need longer.</Text></View>
            <Button variant="secondary" size="sm" label="Redeem" onPress={() => router.push("/(tabs)/profile")} />
          </Card>
        </ScrollView>
      </View>
    );
  }

  const tz = active.local_tz ?? user.profile.home_tz;
  const today = localDate(now, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const dinner = navShortcuts(bundle, day, hhmm).find((x) => x.key === "dinner");
  const currency = active.local_currency ?? user.profile.home_currency;
  const others = pastBills.filter((b) => b.trip_id !== active.id);

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{back}<View style={{ flex: 1 }}><PageHeader eyebrow={`${active.name} · Tools`} title="Split" action={<Chip tone="premium">{passLabel(pass, now)}</Chip>} /></View></View>
        <Eyebrow>New bill</Eyebrow>
        <Card>
          <ListRow onPress={() => router.push(dinner ? { pathname: "/split/new", params: { place: dinner.place.id } } : "/split/new")} leading={<IconCoin name="camera-outline" />} title="Scan a receipt" subtitle={`${dinner ? `${dinner.place.name} · tonight's dinner · ` : ""}${currency} · ${pluralize(bundle.travelers.length, "person", "people")} from your trip`} chevron />
          <ListRow onPress={() => router.push({ pathname: "/split/new", params: { manual: "1", ...(dinner ? { place: dinner.place.id } : {}) } })} leading={<IconCoin name="create-outline" />} title="Enter by hand" subtitle="No receipt, or the scanner missed it" chevron last />
        </Card>
        <Eyebrow>Bills on {active.name}</Eyebrow>
        {bundle.bills.length ? (
          <Card>
            {bundle.bills.map((b, i) => {
              const people = bundle.billParticipants.filter((p) => p.bill_id === b.id);
              const total = billTotal(b, bundle.billItems.filter((x) => x.bill_id === b.id));
              const claimed = people.filter((p) => p.claim_status === "claimed").length;
              return <ListRow key={b.id} last={i === bundle.bills.length - 1} onPress={() => router.push({ pathname: "/split/[id]", params: { id: b.id } })} leading={<IconCoin name="receipt-outline" />} title={b.merchant} subtitle={`${formatMoney(total, b.currency)} · ${pluralize(people.length, "person", "people")}${claimed ? ` · ${claimed} claimed by link` : ""}`} trailing={<Chip tone={b.status === "open" ? "tint" : "plain"}>{b.status === "settled" ? "Settled" : b.status === "open" ? "Open" : "Draft"}</Chip>} accessibilityLabel={`${b.merchant}, ${formatMoney(total, b.currency)}, ${pluralize(people.length, "person", "people")}, ${b.status}`} chevron />;
            })}
          </Card>
        ) : <EmptyState title="No bills yet" body="Scan tonight's receipt and everyone pays their share." />}
        {others.length > 0 && (
          <>
            <Eyebrow>Past splits</Eyebrow>
            <Card>{others.map((b, i) => <ListRow key={b.id} last={i === others.length - 1} leading={<Tile name={b.trip_name} size={40} invert />} title={b.merchant} subtitle={`${b.trip_name} · ${pluralize(b.people, "person", "people")} · ${b.status}`} />)}</Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
