import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { categoriesForPlace, formatDateRange, formatTime, placeColor } from "@voya/core";
import { TripMap } from "@/components/MapView";
import { Button, Card, Chip, EmptyState, Eyebrow, IconCoin, ListRow, Tile, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** Saved place / stay details: Navigate ("Take me back to my hotel"), local-language address for taxis. */
export default function Place() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { bundle } = useData();
  const [showLocal, setShowLocal] = useState(false);
  const place = bundle?.places.find((p) => p.id === id);
  if (!bundle || !place || !user) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Place not found" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  const stay = bundle.stays.find((x) => x.place_id === place.id);
  const cats = categoriesForPlace(bundle, place.id);
  const color = placeColor(bundle, place);
  const tz = bundle.trip.local_tz ?? user.profile.home_tz;
  const lang = bundle.trip.local_language === "ja" ? "日本語" : (bundle.trip.local_language ?? "local language");

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}><Ionicons name="chevron-back" size={24} color={t.text} /></Pressable>
        {place.lat != null && place.lng != null && (
          <TripMap center={{ lat: place.lat, lng: place.lng }} zoom={15} pins={[{ id: place.id, lat: place.lat, lng: place.lng, label: place.name, color, dark: !!stay }]} label={`Map showing ${place.name}`} style={{ height: 200, borderRadius: 18, borderWidth: 1, borderColor: t.border }} />
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <Tile name={place.name} color={color} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{stay ? "Your stay" : cats.map((c) => c.name).join(" · ") || "Saved place"}</Text>
            <Text accessibilityRole="header" style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>{place.name}</Text>
            {place.local_name ? <Text style={{ fontSize: 15, color: t.textMuted, fontFamily: t.font.regular }} accessibilityLanguage={bundle.trip.local_language ?? undefined}>{place.local_name}</Text> : null}
          </View>
          {place.priority === "must" && !stay && <Chip>Must visit</Chip>}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button variant="ink" label={stay ? "Take me back to my hotel" : "Navigate"} icon={<Ionicons name="compass-outline" size={18} color={t.onInk} />} style={{ flex: 1 }} onPress={() => router.push("/(tabs)/navigate")} />
          <Pressable accessibilityRole="button" accessibilityLabel={`${place.name} is saved`} accessibilityState={{ selected: true }} style={{ width: 52, height: 44, borderRadius: 14, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="bookmark" size={18} color={t.primary} /></Pressable>
        </View>

        {stay && (
          <>
            <Eyebrow>Booking</Eyebrow>
            <Card>
              <ListRow leading={<IconCoin name="home-outline" />} title={formatDateRange(stay.check_in?.slice(0, 10) ?? null, stay.check_out?.slice(0, 10) ?? null)} subtitle={`${stay.kind[0]!.toUpperCase()}${stay.kind.slice(1)}${stay.check_in ? ` · Check-in ${formatTime(new Date(stay.check_in), tz)}` : ""}${stay.check_out ? ` · Check-out ${formatTime(new Date(stay.check_out), tz)}` : ""}`} last={!stay.confirmation} />
              {stay.confirmation ? <ListRow title="Confirmation" trailing={<Text style={{ fontFamily: "Menlo", fontSize: 13, color: t.text }}>{stay.confirmation}</Text>} accessibilityLabel={`Confirmation ${stay.confirmation.split("").join(" ")}`} last /> : null}
            </Card>
          </>
        )}

        <Eyebrow>Address</Eyebrow>
        <Card>
          {place.address ? <ListRow title={place.address} subtitle="Tap to copy" last={!place.local_address} /> : null}
          {place.local_address ? (
            <>
              <ListRow onPress={() => setShowLocal((v) => !v)} accessibilityLabel={`Show address in ${lang}`} accessibilityState={{ expanded: showLocal }} leading={<IconCoin name="language-outline" />} title={`Show address in ${lang}`} trailing={<Ionicons name={showLocal ? "chevron-up" : "chevron-down"} size={18} color={t.textFaint} />} last />
              {showLocal && (
                <Animated.View entering={reduce ? undefined : FadeIn.duration(200)} accessible accessibilityLanguage={bundle.trip.local_language ?? undefined} style={{ margin: 8, borderRadius: 14, backgroundColor: t.ink, padding: 20 }}>
                  <Text style={{ color: t.onInk, fontSize: 22, fontFamily: t.font.extrabold, lineHeight: 30 }}>{place.local_name ?? place.name}</Text>
                  <Text style={{ color: t.onInk, fontSize: 20, fontFamily: t.font.semibold, marginTop: 8, lineHeight: 28 }}>{place.local_address}</Text>
                </Animated.View>
              )}
            </>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}
