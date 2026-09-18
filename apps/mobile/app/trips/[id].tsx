import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatDateRange, pluralize, tripDates, tripPhaseLabel } from "@voya/core";
import { Button, Card, Chip, EmptyState, Eyebrow, ListRow, Tile, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useTheme } from "@/lib/theme";

export default function Trip() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { now, trips, active, bundle, setActive } = useData();
  const trip = trips.find((x) => x.id === id);
  if (!trip) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Trip not found" action={<Button variant="secondary" label="Back" onPress={() => router.back()} />} /></View></View>;
  const isActive = trip.id === active?.id;
  const b = isActive ? bundle : null;
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}><Ionicons name="chevron-back" size={24} color={t.text} /></Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Tile name={trip.name} size={64} radius={16} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{trip.cities.join(" → ") || "No cities yet"}</Text>
            <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text }}>{trip.name}</Text>
            <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>{formatDateRange(trip.start_date, trip.end_date)}{tripDates(trip).length ? ` · ${pluralize(tripDates(trip).length, "day")}` : ""}</Text>
          </View>
          <Chip>{tripPhaseLabel(trip, now, trip.local_tz ?? undefined)}</Chip>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button variant="ink" label="Plan" style={{ flex: 1 }} onPress={async () => { if (!isActive) await setActive(trip.id); router.push({ pathname: "/plan", params: trip.start_date ? { day: trip.start_date } : {} }); }} />
          <Button variant="secondary" label={isActive ? "Active trip" : "Set as active"} disabled={isActive} style={{ flex: 1 }} onPress={() => void setActive(trip.id)} />
        </View>
        <Eyebrow>Trip context</Eyebrow>
        <Card>
          <ListRow title="Local currency" trailing={<Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.text }}>{trip.local_currency ?? "—"}</Text>} accessibilityLabel={`Local currency ${trip.local_currency ?? "not set"}`} />
          <ListRow title="Language" trailing={<Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.text }}>{trip.local_language === "ja" ? "日本語" : (trip.local_language ?? "—")}</Text>} accessibilityLabel={`Language ${trip.local_language ?? "not set"}`} />
          <ListRow title="Time zone" trailing={<Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.text }}>{trip.local_tz ?? "—"}</Text>} accessibilityLabel={`Time zone ${trip.local_tz ?? "not set"}`} last />
        </Card>
        {b && (
          <>
            <Eyebrow>{pluralize(b.travelers.length, "traveler")}</Eyebrow>
            <Card>
              {b.travelers.map((tr, i) => <ListRow key={tr.id} last={i === b.travelers.length - 1} leading={<Tile name={tr.name} size={36} radius={18} color={tr.color} />} title={tr.name} subtitle={tr.user_id ? "Voya account" : "No account needed"} />)}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
