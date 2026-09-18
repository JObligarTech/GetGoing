import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import {
  categoriesForPlace, dayPins, formatClock, formatDateRange, formatTime, greeting, itemsForDay, localDate, placeById, placeColor,
  stayForDate, tripDayNumber, tripPhaseLabel, tzOffsetLabel,
} from "@voya/core";
import { TripMap } from "@/components/MapView";
import { TripSwitcher } from "@/components/TripSwitcher";
import { Button, Card, Chip, Dot, EmptyState, Eyebrow, IconCoin, ListRow, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** Home — live map of today's places, the stay, the countdown and clocks; extended FAB on Android. */
export default function Home() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user } = useSession();
  const { now, trips, active, bundle, setActive } = useData();
  if (!user) return null;
  const homeTz = user.profile.home_tz;
  const hello = `${greeting(now, active?.local_tz ?? homeTz)}, ${user.profile.display_name.split(" ")[0]}`;

  if (!active) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.content}>
          <Text style={{ color: t.textMuted, fontSize: 13, fontFamily: t.font.medium }}>{hello}</Text>
          <Text accessibilityRole="header" style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text }}>No trips yet</Text>
          <EmptyState title="Start with a trip" body="Voya remembers the trip so you don't have to." action={<Button label="Create a trip" onPress={() => router.push("/trips/new")} />} />
        </View>
      </View>
    );
  }

  const tz = active.local_tz ?? homeTz;
  const today = localDate(now, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const items = bundle ? itemsForDay(bundle, day).filter((i) => i.place_id) : [];
  const stay = bundle ? stayForDate(bundle.stays, day) : null;
  const hotel = stay && bundle ? placeById(bundle, stay.place_id) : null;
  const pins = bundle ? dayPins(bundle, day) : [];
  const center = hotel?.lat != null && hotel.lng != null ? { lat: hotel.lat - 0.007, lng: hotel.lng } : { lat: 35.6885, lng: 139.702 };
  const city = active.cities[0] ?? active.name;
  const raised = { backgroundColor: t.surfaceRaised, borderRadius: 12, shadowColor: "#000", shadowOpacity: t.scheme === "dark" ? 0.4 : 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 };
  const enter = (i: number) => (reduce ? undefined : FadeInDown.duration(220).delay(i * 40));

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <Animated.View entering={enter(0)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.textMuted, fontSize: 13, fontFamily: t.font.medium }}>{hello}</Text>
            <TripSwitcher trips={trips} activeId={active.id} onSelect={setActive} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-outline" size={20} color={t.text} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={enter(1)} style={{ height: 300, borderRadius: Platform.OS === "android" ? 20 : 18, overflow: "hidden", borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceTint }}>
          <TripMap center={center} zoom={13.25} pins={pins} label={`Map of ${city} with ${pins.length} pins: ${pins.map((p) => p.label).join(", ")}`} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={[raised, { height: 30, paddingHorizontal: 10, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8 }]}>
              <Dot color={t.primary} size={8} /><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.text }}>{tripPhaseLabel(active, now, tz)}</Text>
            </View>
            <View style={[raised, { paddingHorizontal: 12, paddingVertical: 8, alignItems: "flex-end" }]} accessible accessibilityLabel={`${city} time ${formatTime(now, tz)}, home ${formatTime(now, homeTz)}`}>
              <Text style={{ fontSize: 11, fontFamily: t.font.semibold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7 }}>{city}</Text>
              <Text style={{ fontSize: 20, fontFamily: t.font.extrabold, color: t.text }}>{formatTime(now, tz)}</Text>
              <Text style={{ fontSize: 11, color: t.textMuted, fontFamily: t.font.regular }}>Home {formatTime(now, homeTz)} · {tzOffsetLabel(now, tz, homeTz)}</Text>
            </View>
          </View>
          {hotel && stay && (
            <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
              <View style={[raised, { borderRadius: 14 }]}>
                <ListRow
                  onPress={() => router.push({ pathname: "/place/[id]", params: { id: hotel.id } })}
                  accessibilityLabel={`Your stay: ${hotel.name}. Open details`}
                  leading={<IconCoin name="home-outline" />}
                  title={hotel.name}
                  subtitle={`${formatDateRange(stay.check_in?.slice(0, 10) ?? null, stay.check_out?.slice(0, 10) ?? null)}${stay.check_in ? ` · Check-in ${formatTime(new Date(stay.check_in), tz)}` : ""}`}
                  trailing={<Chip>{active.traveler_count} travelers</Chip>}
                  last
                />
              </View>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={enter(2)} style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Eyebrow>Saved for {formatDateRange(day, null)}</Eyebrow>
            <Text accessibilityRole="link" onPress={() => router.push("/plan")} style={{ color: t.primary, fontSize: 13, fontFamily: t.font.bold }}>All {active.place_count} places</Text>
          </View>
          {items.length ? (
            <Card>
              {items.map((i, idx) => {
                const p = placeById(bundle!, i.place_id)!;
                const cat = categoriesForPlace(bundle!, p.id)[0]?.name ?? (p.priority === "must" ? "Must visit" : "Saved");
                return <ListRow key={i.id} last={idx === items.length - 1} onPress={() => router.push({ pathname: "/place/[id]", params: { id: p.id } })} leading={<Dot color={placeColor(bundle!, p)} />} title={p.name} subtitle={[cat, formatClock(i.start_time), i.note].filter(Boolean).join(" · ")} chevron />;
              })}
            </Card>
          ) : (
            <EmptyState title="Nothing planned for this day yet" body="Save places in Plan and drop them into the day." />
          )}
        </Animated.View>
      </ScrollView>
      {Platform.OS === "android" && (
        <Pressable accessibilityRole="button" accessibilityLabel="Navigate" onPress={() => router.push("/(tabs)/navigate")} style={{ position: "absolute", right: 16, bottom: 16, height: 56, paddingLeft: 16, paddingRight: 20, borderRadius: 16, backgroundColor: t.primary, flexDirection: "row", alignItems: "center", gap: 10, elevation: 6 }}>
          <Ionicons name="compass-outline" size={22} color={t.onPrimary} />
          <Text style={{ color: t.onPrimary, fontSize: 14, fontFamily: t.font.bold }}>Navigate</Text>
        </Pressable>
      )}
    </View>
  );
}
