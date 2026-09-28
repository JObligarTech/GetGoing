import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TripBundle } from "@voya/core";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { agoLabel, packsStore, savedAtStore, useNow, useOnline } from "@/lib/offline";
import { useTheme } from "@/lib/theme";

/** "You're offline · showing Japan 2027 saved 41 min ago" (mockup 6b). */
export function OfflineBanner({ tripName }: { tripName: string | null }) {
  const t = useTheme();
  const online = useOnline();
  const saved = savedAtStore.use();
  const nowMs = useNow();
  if (online) return null;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.ink, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}>
      <Ionicons name="cloud-offline-outline" size={14} color={t.onInk} />
      <Text style={{ flex: 1, fontSize: 12.5, fontFamily: t.font.bold, color: t.onInk }}>You&apos;re offline{tripName ? ` · showing ${tripName}${saved ? ` saved ${agoLabel(saved.savedAt, nowMs)}` : ""}` : ""}</Text>
    </View>
  );
}

/** Home, offline: what's cached, what's from a while ago, and what needs internet. */
export function OfflineCard({ bundle, fxPair, fxAsOf, now }: { bundle: TripBundle; fxPair: string | null; fxAsOf: string; now: Date }) {
  const t = useTheme();
  const online = useOnline();
  const packs = packsStore.use();
  if (online) return null;
  const city = bundle.trip.cities[0] ?? bundle.trip.name;
  const rows = [
    { title: `${bundle.places.length} saved places`, state: "Cached", ok: true },
    { title: `${city} map · ${bundle.routes.length} saved routes`, state: Object.keys(packs).some((k) => k.startsWith(`map:${bundle.trip.id}:`)) ? "Cached" : "Not downloaded", ok: true },
    ...(fxPair ? [{ title: `${fxPair} rate`, state: `From ${agoLabel(fxAsOf, now.getTime())}`, ok: true }] : []),
    { title: `Text translation · ${bundle.phrases.length} phrases`, state: bundle.trip.local_language && packs[`lang:${bundle.trip.local_language}`] ? "Pack installed" : "Phrasebook", ok: true },
    { title: "Receipt scan · live transit · voice", state: "Needs internet", ok: false },
  ];
  return (
    <>
      <Eyebrow>Available offline</Eyebrow>
      <Card>
        {rows.map((r, i) => (
          <View key={r.title} accessible accessibilityLabel={`${r.title}: ${r.state}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: r.ok ? t.surfaceTint : t.canvas, alignItems: "center", justifyContent: "center" }}><Ionicons name={r.ok ? "checkmark" : "cloud-offline-outline"} size={16} color={r.ok ? t.onTint : t.textMuted} /></View>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{r.title}</Text>
            <Chip tone={r.ok ? "tint" : "plain"}>{r.state}</Chip>
          </View>
        ))}
      </Card>
    </>
  );
}
