import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDateRange, type TripListItem } from "@voya/core";
import { Card, ListRow, Tile } from "./ui";
import { useTheme } from "@/lib/theme";

/** Trip name in the Home header opens a bottom sheet of trips (accessible modal; Esc/back closes). */
export function TripSwitcher({ trips, activeId, onSelect }: { trips: TripListItem[]; activeId: string; onSelect: (id: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const active = trips.find((x) => x.id === activeId);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${active?.name ?? "Pick a trip"}, switch trip`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
        <Text numberOfLines={1} accessibilityRole="header" style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>{active?.name ?? "Pick a trip"}</Text>
        <Ionicons name="chevron-down" size={18} color={t.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>Switch trip</Text>
          <Card>
            {trips.map((trip, i) => (
              <ListRow
                key={trip.id}
                last={i === trips.length - 1}
                active={trip.id === activeId}
                accessibilityLabel={`${trip.name}, ${formatDateRange(trip.start_date, trip.end_date)}${trip.id === activeId ? ", selected" : ""}`}
                onPress={() => { onSelect(trip.id); setOpen(false); }}
                leading={<Tile name={trip.name} size={36} radius={10} invert={trip.id !== activeId} />}
                title={trip.name}
                subtitle={formatDateRange(trip.start_date, trip.end_date)}
              />
            ))}
          </Card>
        </View>
      </Modal>
    </>
  );
}
