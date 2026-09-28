import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { PERMISSION_ROWS } from "@voya/core";
import { Button, Card, Eyebrow, ListRow, PageHeader, announce, screenStyles } from "@/components/ui";
import { permStore } from "@/lib/offline";
import { useTheme } from "@/lib/theme";

type Key = (typeof PERMISSION_ROWS)[number]["key"];
type State = "granted" | "denied" | "undetermined" | "limited" | "unavailable";
const ICONS: Record<Key, keyof typeof Ionicons.glyphMap> = { location: "location-outline", microphone: "mic-outline", camera: "camera-outline", photos: "images-outline", contacts: "people-outline", notifications: "notifications-outline" };

function label(key: Key, state: State, declined: boolean): { text: string; tone: "on" | "off" | "muted" } {
  if (state === "granted") return { text: key === "location" ? "While using" : key === "photos" ? "Selected only" : key === "notifications" ? "On" : "Allowed", tone: "on" };
  if (state === "limited") return { text: "Selected only", tone: "on" };
  if (state === "denied") return { text: `Off · ${key === "camera" ? "receipt scan and camera translation won't work" : "allow it in Settings"}`, tone: "off" };
  if (state === "unavailable") return { text: "Not available in this build", tone: "muted" };
  return { text: declined ? "Declined in Get Going · ask again from the feature" : "Not asked yet", tone: "muted" };
}

/** Permissions & legal (mockup 7a): each capability's state on this device, with the way back into OS Settings when it's off. */
export default function PermissionsScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const asked = permStore.use();
  const [states, setStates] = useState<Partial<Record<Key, State>>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Partial<Record<Key, State>> = { microphone: "undetermined", contacts: "unavailable", notifications: "undetermined" };
      try { out.location = (await Location.getForegroundPermissionsAsync()).status as State; } catch { out.location = "unavailable"; }
      try { out.camera = (await ImagePicker.getCameraPermissionsAsync()).status as State; } catch { out.camera = "unavailable"; }
      try { const p = await ImagePicker.getMediaLibraryPermissionsAsync(); out.photos = p.accessPrivileges === "limited" ? "limited" : (p.status as State); } catch { out.photos = "unavailable"; }
      if (alive) setStates(out);
    })();
    return () => { alive = false; };
  }, []);
  const openSettings = () => { Linking.openSettings().catch(() => announce("Open Settings from your home screen to change permissions.")); };
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Settings" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}><PageHeader eyebrow="Settings" title="Permissions" /></View>
        </View>
        <Text style={{ fontSize: 13.5, color: t.textMuted, fontFamily: t.font.regular, lineHeight: 19 }}>Get Going asks for each of these the first time a feature needs it. Turn them on or off here or in {Platform.OS === "ios" ? "iOS" : "Android"} Settings.</Text>
        <Card>
          {PERMISSION_ROWS.map((r, i) => {
            const state = states[r.key] ?? "undetermined";
            const { text, tone } = label(r.key, state, asked[r.key] === "declined");
            return (
              <View key={r.key} accessible accessibilityLabel={`${r.title}: ${r.detail}. ${text}${tone === "off" ? `. ${r.fallback}` : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === PERMISSION_ROWS.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: tone === "off" ? "rgba(200,60,60,0.12)" : t.surfaceTint, alignItems: "center", justifyContent: "center" }}><Ionicons name={ICONS[r.key]} size={18} color={tone === "off" ? t.danger : t.onTint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>{r.title}</Text>
                  <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{r.detail}</Text>
                  <Text style={{ fontSize: 12, fontFamily: t.font.bold, color: tone === "on" ? t.primary : tone === "off" ? t.danger : t.textMuted }}>{text}</Text>
                </View>
                {tone === "off" && <Button variant="secondary" size="sm" label="Open Settings" accessibilityLabel={`Open Settings to allow ${r.title.toLowerCase()}`} onPress={openSettings} />}
              </View>
            );
          })}
        </Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ flex: 1, fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>Get Going explains each permission once before {Platform.OS === "ios" ? "iOS" : "Android"} asks. Reset to see the explanations again.</Text>
          <Button variant="ghost" size="sm" label="Reset" disabled={Object.keys(asked).length === 0} onPress={() => { void permStore.set({}); announce("Explanations will show again."); }} />
        </View>

        <Eyebrow>Legal</Eyebrow>
        <Card>
          <ListRow title="Terms of Service" chevron onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL ?? "https://getgoing.app"}/legal/terms`)} />
          <ListRow title="Privacy Policy" chevron onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL ?? "https://getgoing.app"}/legal/privacy`)} />
          <ListRow title="Download or delete my data" subtitle="Trips, places, receipts, translations" chevron last onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL ?? "https://getgoing.app"}/settings/permissions`)} />
        </Card>
      </ScrollView>
    </View>
  );
}
