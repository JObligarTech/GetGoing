import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  boundsOf, categoriesForPlace, dayPins, formatClock, formatDayHeading, itemsForDay, placeById, placeColor, suggestionsForSlot,
  tripDates, tripDayNumber, unscheduledPlaces,
} from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { TripMap } from "@/components/MapView";
import { Button, Card, Dot, EmptyState, Hint, ListRow, Tile, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useTheme } from "@/lib/theme";

/** Plan · Day N — timeline with an open slot to fill; Map view shows the day's pins and nearby suggestions. */
export default function Plan() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { day: qDay } = useLocalSearchParams<{ day?: string }>();
  const { bundle, assignPlaceToSlot } = useData();
  const [view, setView] = useState<"day" | "map">("day");
  const [slot, setSlot] = useState<{ itemId: string; time: string; index: number } | null>(null);
  if (!bundle) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" body="Create a trip to start planning." /></View></View>;

  const dates = tripDates(bundle.trip);
  const day = qDay && dates.includes(qDay) ? qDay : dates[0] ?? qDay ?? "";
  const dayNo = tripDayNumber(bundle.trip, day) ?? 1;
  const items = itemsForDay(bundle, day);
  const pins = dayPins(bundle, day);
  const unscheduled = unscheduledPlaces(bundle);
  const b = boundsOf(pins);
  const idx = Math.max(0, dates.indexOf(day));
  const start = Math.max(0, Math.min(idx - 1, dates.length - 3));
  const window = dates.slice(start, start + 3);
  const hhmm = (v: string | null) => (v ? v.replace(/^0/, "") : "—");
  const suggestions = slot ? suggestionsForSlot(bundle, day, slot.index).map((x) => ({ ...x, color: placeColor(bundle, x.place), category: categoriesForPlace(bundle, x.place.id)[0]?.name ?? "Saved" })) : [];
  const openIndex = items.findIndex((i) => !i.place_id);
  const nearby = openIndex >= 0 ? suggestionsForSlot(bundle, day, openIndex).length : 0;

  return (
    <View style={s.screen}>
      {view === "map" ? (
        <View style={{ flex: 1 }}>
          <TripMap interactive center={b?.center ?? { lat: 35.672, lng: 139.702 }} zoom={13.4} pins={[...pins, ...unscheduled.filter((p) => p.lat != null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: categoryColors.unscheduled }))]} label={`Map of Day ${dayNo}: ${pins.map((p) => p.label).join(", ")}`} style={{ flex: 1 }} />
          <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to list" onPress={() => setView("day")} style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.surfaceRaised, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="chevron-back" size={18} color={t.text} /><Text style={{ fontSize: 14, fontFamily: t.font.bold, color: t.text }}>{bundle.trip.name} · Day {dayNo}</Text>
            </Pressable>
            <View style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.surfaceRaised, flexDirection: "row", alignItems: "center", gap: 8 }}><Dot color={categoryColors.unscheduled} /><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.textMuted }}>{unscheduled.length} unscheduled</Text></View>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{bundle.trip.name} · Day {dayNo}</Text>
              <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>{formatDayHeading(day)}</Text>
            </View>
            {dates.length > 1 && (
              <View accessibilityRole="radiogroup" accessibilityLabel="Trip day" style={{ flexDirection: "row", gap: 4, backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, padding: 4 }}>
                {window.map((d) => {
                  const n = dates.indexOf(d) + 1, on = d === day;
                  return (
                    <Pressable key={d} accessibilityRole="radio" accessibilityLabel={`Day ${n}, ${d}`} accessibilityState={{ checked: on }} onPress={() => router.setParams({ day: d })} style={{ width: 36, height: 32, borderRadius: 9, backgroundColor: on ? t.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.textMuted }}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {items.length ? (
            <Card>
              {items.map((item, i) => {
                const p = placeById(bundle, item.place_id);
                const time = <Text style={{ width: 44, fontSize: 12.5, fontFamily: t.font.bold, color: t.textMuted }}>{hhmm(item.start_time)}</Text>;
                if (!p) {
                  return (
                    <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${hhmm(item.start_time)}, ${item.title ?? "Open slot"}, open slot, ${suggestionsForSlot(bundle, day, i).length} saved nearby`} onPress={() => setSlot({ itemId: item.id, time: hhmm(item.start_time), index: i })} style={{ margin: 4, padding: 11, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.borderStrong, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {time}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.textMuted }}>{item.title ?? "Open slot"}</Text>
                        <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>Open slot · {suggestionsForSlot(bundle, day, i).length} saved nearby</Text>
                      </View>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.surfaceTint, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={18} color={t.onTint} /></View>
                    </Pressable>
                  );
                }
                const cat = categoriesForPlace(bundle, p.id)[0]?.name ?? (p.priority === "must" ? "Must visit" : "Saved");
                return <ListRow key={item.id} last={i === items.length - 1} onPress={() => router.push({ pathname: "/place/[id]", params: { id: p.id } })} accessibilityLabel={`${formatClock(item.start_time)}, ${p.name}, ${cat}${item.note ? `, ${item.note}` : ""}`} leading={<>{time}<Dot color={placeColor(bundle, p)} /></>} title={p.name} subtitle={[cat, item.note].filter(Boolean).join(" · ")} />;
              })}
            </Card>
          ) : (
            <EmptyState title={`Nothing on Day ${dayNo} yet`} body={`${unscheduled.length} saved places are waiting. Pick from the map.`} />
          )}
          {openIndex >= 0 && <Hint>{`Tap the open slot to pick from ${nearby} saved ${nearby === 1 ? "place" : "places"} nearby.`}</Hint>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: "auto" }}>
            <Button variant="ink" size="cta" label="Navigate the day" style={{ flex: 1 }} onPress={() => router.push("/(tabs)/navigate")} />
            <Button variant="secondary" size="cta" label="Map" style={{ flex: 1 }} onPress={() => setView("map")} />
          </View>
        </ScrollView>
      )}

      <Modal visible={!!slot} transparent animationType="slide" onRequestClose={() => setSlot(null)} accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setSlot(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>Fill the {slot?.time} slot</Text>
          <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Saved places near your previous stop.</Text>
          {suggestions.length ? (
            <Card>
              {suggestions.map((x, i) => (
                <ListRow key={x.place.id} last={i === suggestions.length - 1} accessibilityLabel={`Add ${x.place.name}, ${x.category}, ${x.minutes} minutes from ${x.fromName}`} onPress={async () => { await assignPlaceToSlot(slot!.itemId, x.place.id); setSlot(null); announce(`${x.place.name} added to the ${slot!.time} slot`); }} leading={<Tile name={x.place.name} size={40} radius={10} color={x.color} />} title={x.place.name} subtitle={`${x.category} · ${x.minutes} min from ${x.fromName}`} trailing={<Text style={{ color: t.primary, fontSize: 13, fontFamily: t.font.bold }}>Add</Text>} />
              ))}
            </Card>
          ) : (
            <Card><Text style={{ padding: 14, color: t.textMuted, fontSize: 13 }}>Every saved place is already on a day.</Text></Card>
          )}
          <Button variant="secondary" label="Close" onPress={() => setSlot(null)} />
        </View>
      </Modal>
    </View>
  );
}
