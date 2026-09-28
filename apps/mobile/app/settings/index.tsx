import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SETTING_COPY, offlinePacks, readSettings, type TripBehaviour } from "@voya/core";
import { Button, Card, Eyebrow, ListRow, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { agoLabel, packsStore, useNow } from "@/lib/offline";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const THEMES: { value: "light" | "dark" | "system"; label: string }[] = [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Auto" }];

/** Settings (mockup 6a): appearance, trip behaviour, offline packs, permissions & legal. */
export default function SettingsScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useSession();
  const { bundle } = useData();
  const packs = packsStore.use();
  const nowMs = useNow();
  const [status, setStatus] = useState("");
  if (!user) return null;
  const settings = readSettings(user.profile.settings);
  const flip = async (key: keyof TripBehaviour) => {
    const next = !settings[key];
    const err = await updateProfile({ settings: { ...settings, [key]: next } });
    const m = err ?? `${SETTING_COPY[key].title} ${next ? "on" : "off"}.`;
    setStatus(m); announce(m);
  };
  const setTheme = async (theme: "light" | "dark" | "system") => { const err = await updateProfile({ theme }); const m = err ?? `Theme: ${theme === "system" ? "Auto" : theme}.`; setStatus(m); announce(m); };
  const list = bundle ? offlinePacks(bundle) : [];
  const mark = (id: string, on: boolean) => { const next = { ...packsStore.get() }; if (on) next[id] = new Date().toISOString(); else delete next[id]; void packsStore.set(next); announce(on ? "Downloaded." : "Removed."); };
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}><PageHeader eyebrow="Profile" title="Settings" /></View>
        </View>

        <Eyebrow>Appearance</Eyebrow>
        <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>Theme</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Theme" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface }}>
            {THEMES.map((o) => { const on = user.profile.theme === o.value; return <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={o.label} onPress={() => setTheme(o.value)} style={{ height: 32, paddingHorizontal: 12, borderRadius: 9, backgroundColor: on ? t.primary : "transparent", justifyContent: "center" }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.textMuted }}>{o.label}</Text></Pressable>; })}
          </View>
        </Card>

        <Eyebrow>Trip behaviour</Eyebrow>
        <Card>
          {(Object.keys(SETTING_COPY) as (keyof TripBehaviour)[]).map((key, i, all) => (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i === all.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>{SETTING_COPY[key].title}</Text><Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{SETTING_COPY[key].detail}</Text></View>
              <Switch accessibilityLabel={SETTING_COPY[key].title} value={settings[key]} onValueChange={() => flip(key)} trackColor={{ true: t.primary, false: t.borderStrong }} />
            </View>
          ))}
        </Card>
        {status ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, fontFamily: t.font.semibold, color: t.primary }}>{status}</Text> : null}

        <Eyebrow>Offline</Eyebrow>
        <Card>
          {list.length === 0 && <ListRow title="No trip yet" subtitle="Offline packs follow your active trip." last />}
          {list.map((p, i) => {
            const got = p.kind === "trip" || Boolean(packs[p.id]);
            const size = p.sizeMb ? `${p.sizeMb} MB` : null;
            const subtitle = p.kind === "trip" ? p.detail : [p.detail, size ? `≈ ${size}` : null].filter(Boolean).join(" · ");
            const trailing = p.kind === "trip"
              ? <Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: t.primary }}>Up to date</Text>
              : got
                ? <Button variant="ghost" size="sm" label="Downloaded" accessibilityLabel={`Remove ${p.title}, downloaded ${agoLabel(packs[p.id]!, nowMs)}`} icon={<Ionicons name="checkmark" size={14} color={t.primary} />} onPress={() => mark(p.id, false)} />
                : <Button variant="secondary" size="sm" label="Download" accessibilityLabel={`Download ${p.title}${size ? `, ${size}` : ""}${p.wifiOnly ? ", Wi-Fi only" : ""}`} icon={<Ionicons name="download-outline" size={14} color={t.text} />} onPress={() => mark(p.id, true)} />;
            return <ListRow key={p.id} title={p.title} subtitle={subtitle} trailing={trailing} last={i === list.length - 1} />;
          })}
        </Card>

        <Eyebrow>Privacy</Eyebrow>
        <Card><ListRow onPress={() => router.push("/settings/permissions")} title="Permissions & legal" subtitle="Location, microphone, camera, notifications · Terms, Privacy, your data" chevron last /></Card>
      </ScrollView>
    </View>
  );
}
