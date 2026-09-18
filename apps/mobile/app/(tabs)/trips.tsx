import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { boundsOf, deriveStatus, formatDateRange, pluralize, tripDates, tripPhaseLabel } from "@voya/core";
import { TripMap } from "@/components/MapView";
import { Card, Chip, EmptyState, Eyebrow, ListRow, PageHeader, Tile, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** Trips list with the active trip highlighted, plus a route-map and itinerary preview. */
export default function Trips() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { now, trips, active, bundle } = useData();
  if (!user) return null;
  const pins = (bundle?.places ?? []).filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: bundle!.stays.some((x) => x.place_id === p.id) ? "#7DBA8E" : "#E0703A" }));
  const b = boundsOf(pins);
  const days = active ? tripDates(active).length : 0;
  const cities = active?.cities.length ? active.cities : ["Trip"];
  const per = Math.max(1, Math.floor(days / cities.length));

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow={user.profile.display_name.split(" ")[0]} title="Trips" action={
          <Pressable accessibilityRole="button" accessibilityLabel="New trip" onPress={() => router.push("/trips/new")} style={{ width: 44, height: 44, borderRadius: Platform.OS === "android" ? 16 : 22, backgroundColor: t.ink, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="add" size={22} color={t.onInk} />
          </Pressable>
        } />
        {trips.length ? (
          <Card>
            {trips.map((trip, i) => {
              const status = deriveStatus(trip, now, trip.local_tz ?? user.profile.home_tz);
              const chip = status === "draft" ? "Draft" : status === "past" ? "Past" : tripPhaseLabel(trip, now, trip.local_tz ?? undefined);
              const isActive = trip.id === active?.id;
              return (
                <ListRow
                  key={trip.id}
                  last={i === trips.length - 1}
                  active={isActive}
                  onPress={() => router.push({ pathname: "/trips/[id]", params: { id: trip.id } })}
                  accessibilityLabel={`${trip.name}, ${formatDateRange(trip.start_date, trip.end_date)}, ${chip}${isActive ? ", active trip" : ""}`}
                  leading={<Tile name={trip.name} invert={!isActive} radius={Platform.OS === "android" ? 16 : 12} />}
                  title={status === "draft" ? `${trip.name} · draft` : trip.name}
                  subtitle={`${formatDateRange(trip.start_date, trip.end_date)} · ${pluralize(trip.traveler_count, "traveler")} · ${pluralize(trip.place_count, "place")}`}
                  trailing={<Chip tone={status === "upcoming" || status === "active" ? "tint" : "plain"}>{chip}</Chip>}
                />
              );
            })}
          </Card>
        ) : (
          <EmptyState title="No trips yet" body="Create one to give every tool its context." />
        )}
        {active && (
          <>
            <Eyebrow>{active.name} · preview</Eyebrow>
            <TripMap center={b?.center ?? { lat: 35.68, lng: 139.75 }} zoom={b ? Math.max(9, 11.5 - b.span * 10) : 10.5} pins={pins} label={`Map of ${active.name} with ${pins.length} saved places`} style={{ height: 140, borderRadius: 16, borderWidth: 1, borderColor: t.border }} />
            <Card>
              {cities.map((c, i) => {
                const start = i * per + 1, end = i === cities.length - 1 ? days : Math.min(days, start + per - 1);
                const label = days ? (start === end ? `Day ${start}` : `Day ${start}–${end}`) : "—";
                return (
                  <View key={c} accessible accessibilityLabel={`${label}, ${c}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === cities.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                    <Text style={{ width: 64, fontSize: 12, fontFamily: t.font.bold, color: t.textMuted }}>{label}</Text>
                    <Text style={{ fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{c}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
