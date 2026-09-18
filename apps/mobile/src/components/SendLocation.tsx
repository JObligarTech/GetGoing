import { useState } from "react";
import { Modal, Pressable, Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { initial, type Traveler } from "@voya/core";
import { Button, Card, Chip, IconCoin, ListRow, announce } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/**
 * "Send my location": one foreground position read, an OpenStreetMap link, the OS share
 * sheet. Nothing is stored or sent to Voya's backend.
 */
export function SendLocation({ travelers, senderName, tz }: { travelers: Traveler[]; senderName: string; tz: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<string[]>(() => travelers.map((x) => x.id));
  const [status, setStatus] = useState<{ text?: string; error?: string; busy?: boolean }>({});

  const send = async () => {
    setStatus({ busy: true });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") { const error = "Location permission was denied. Allow it in Settings to share where you are."; setStatus({ error }); announce(error); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = pos.coords.latitude.toFixed(5), lng = pos.coords.longitude.toFixed(5);
      const at = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date());
      const names = travelers.filter((x) => to.includes(x.id)).map((x) => x.name.split(" ")[0]);
      const message = `${senderName} is here (${at}): https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
      const res = await Share.share({ message });
      const text = res.action === Share.sharedAction ? `Shared with ${names.join(", ") || "your travelers"}.` : "";
      setStatus({ text });
      if (text) announce(text);
    } catch {
      const error = "Couldn't get your location right now.";
      setStatus({ error }); announce(error);
    }
  };

  return (
    <>
      <ListRow onPress={() => setOpen(true)} leading={<IconCoin name="paper-plane-outline" />} title="Send my location" subtitle={`to ${travelers.map((x) => x.name.split(" ")[0]).join(", ") || "your travelers"}`} trailing={<Chip>Live</Chip>} last />
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>Send my location</Text>
          <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Voya reads your position once and opens your share sheet with a map link. It isn&apos;t stored.</Text>
          <Card>
            {travelers.map((x, i) => {
              const on = to.includes(x.id);
              return (
                <Pressable key={x.id} accessibilityRole="checkbox" accessibilityLabel={x.name} accessibilityState={{ checked: on }} onPress={() => setTo((v) => (on ? v.filter((id) => id !== x.id) : [...v, x.id]))} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 52, borderBottomWidth: i === travelers.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                  <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? t.primary : t.textFaint} />
                  <View accessible={false} importantForAccessibility="no" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: x.color, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 10, fontFamily: t.font.bold }}>{initial(x.name)}</Text></View>
                  <Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{x.name}</Text>
                </Pressable>
              );
            })}
            {travelers.length === 0 && <Text style={{ padding: 14, fontSize: 13, color: t.textMuted }}>Add travelers in People to pick recipients; the link still shares.</Text>}
          </Card>
          {status.error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{status.error}</Text> : null}
          {status.text ? <Text accessibilityLiveRegion="polite" style={{ color: t.primary, fontSize: 13, fontFamily: t.font.semibold }}>{status.text}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" label="Close" style={{ flex: 1 }} onPress={() => setOpen(false)} />
            <Button label="Share my location" icon={<Ionicons name="paper-plane-outline" size={16} color={t.onPrimary} />} style={{ flex: 1 }} onPress={send} disabled={!!status.busy && !status.text && !status.error} />
          </View>
        </View>
      </Modal>
    </>
  );
}
