import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, useReducedMotion } from "react-native-reanimated";
import {
  compareModes, formatDistance, formatDuration, formatMoney, formatTime, localDate, MODE_LABEL, navShortcuts, placeById, placeColor,
  stayForDate, TRAVEL_MODES, tripDayNumber, type RouteResult, type RouteStep, type TravelMode,
} from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { TripMap } from "@/components/MapView";
import { Button, Card, Chip, Dot, EmptyState, Eyebrow, ListRow, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { routing } from "@/lib/routing";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const MODE_ICON: Record<TravelMode, keyof typeof Ionicons.glyphMap> = { walk: "walk-outline", transit: "train-outline", drive: "car-outline", cycle: "bicycle-outline" };
const STEP_ICON: Record<RouteStep["kind"], keyof typeof Ionicons.glyphMap> = { walk: "walk-outline", transit: "train-outline", turn: "return-up-back-outline", arrive: "flag-outline" };

/**
 * Directions: from the hotel ("current location" until device location lands) to a saved
 * place, compared across modes. Map with the turn card on top, ETA sheet + steps below.
 */
export default function RouteScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { to: qTo, from: qFrom, mode: qMode } = useLocalSearchParams<{ to?: string; from?: string; mode?: string }>();
  const { user } = useSession();
  const { now, active, bundle } = useData();
  const [results, setResults] = useState<Record<TravelMode, RouteResult | null> | null>(null);
  const [mode, setMode] = useState<TravelMode>(TRAVEL_MODES.includes(qMode as TravelMode) ? (qMode as TravelMode) : "transit");
  const [shared, setShared] = useState<string | null>(null);

  const tz = active?.local_tz ?? user?.profile.home_tz ?? "UTC";
  const today = localDate(now, tz);
  const day = active ? (tripDayNumber(active, today) ? today : active.start_date ?? today) : today;
  const to = bundle ? placeById(bundle, qTo ?? null) : null;
  const stay = bundle ? stayForDate(bundle.stays, day) : null;
  const hotel = stay && bundle ? placeById(bundle, stay.place_id) : null;
  const from = bundle && qFrom && qFrom !== "current" ? placeById(bundle, qFrom) : hotel;
  const ok = !!to && !!from && to.lat != null && to.lng != null && from.lat != null && from.lng != null;
  const currency = active?.local_currency ?? user?.profile.home_currency ?? "USD";

  useEffect(() => {
    if (!ok) return;
    let alive = true;
    compareModes({ lat: from.lat!, lng: from.lng! }, { lat: to.lat!, lng: to.lng! }, routing, currency).then((r) => { if (alive) setResults(r); });
    return () => { alive = false; };
  }, [ok, from?.id, from?.lat, from?.lng, to?.id, to?.lat, to?.lng, currency]);

  if (!bundle || !user || !active || !ok) {
    return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Can't route that" body="Pick a saved place with a location, and make sure the trip has a stay." action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  }

  const r = results?.[mode] ?? null;
  const modes = results ? TRAVEL_MODES.filter((m) => results[m]) : [];
  const arrive = r ? new Date(now.getTime() + r.durationSec * 1000) : null;
  const toColor = placeColor(bundle, to);
  const fromIsHotel = from.id === hotel?.id;
  const pins = [
    { id: from.id, lat: from.lat!, lng: from.lng!, label: from.name, color: fromIsHotel ? categoryColors.stay : placeColor(bundle, from), dark: fromIsHotel },
    { id: to.id, lat: to.lat!, lng: to.lng!, label: to.name, color: toColor },
  ];
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const shortcuts = navShortcuts(bundle, day, hhmm).filter((x) => x.place.id !== to.id && x.place.id !== from.id);
  const summary = r ? `${formatDuration(r.durationSec)} · ${formatDistance(r.distanceM)}${r.fare ? ` · ${formatMoney(r.fare.amount, r.fare.currency)}` : ""}${r.transfers ? ` · ${r.transfers} transfer${r.transfers > 1 ? "s" : ""}` : ""}` : "";
  const first = r?.steps[0];
  const raised = { backgroundColor: t.surfaceRaised, borderRadius: 14, shadowColor: "#000", shadowOpacity: t.scheme === "dark" ? 0.4 : 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 };

  const pick = (m: TravelMode) => { setMode(m); router.setParams({ mode: m }); announce(`${MODE_LABEL[m]}, ${results?.[m] ? formatDuration(results[m]!.durationSec) : ""}`); };
  const shareEta = async () => {
    if (!r || !arrive) return;
    const message = `${user.profile.display_name.split(" ")[0]} arrives at ${to.name} around ${formatTime(arrive, tz)} (${formatDuration(r.durationSec)} by ${mode}).`;
    try { const res = await Share.share({ message }); setShared(res.action === Share.sharedAction ? "Shared" : null); } catch { setShared(null); }
  };

  return (
    <View style={s.screen}>
      <View style={{ height: 320 + insets.top }}>
        <TripMap interactive center={{ lat: (from.lat! + to.lat!) / 2, lng: (from.lng! + to.lng!) / 2 }} zoom={13.6} pins={pins} path={r?.geometry} label={`Map of the ${mode} route from ${from.name} to ${to.name}${summary ? `, ${summary}` : ""}`} style={{ flex: 1 }} />
        <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[raised, { width: 44, height: 44, alignItems: "center", justifyContent: "center" }]}><Ionicons name="chevron-back" size={22} color={t.text} /></Pressable>
          <View style={[raised, { height: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }]}><Dot color={toColor} size={8} /><Text numberOfLines={1} style={{ fontSize: 14, fontFamily: t.font.bold, color: t.text }}>To {to.name}</Text></View>
        </View>
        {first && r && (
          <Animated.View entering={reduce ? undefined : FadeInUp.duration(220)} accessible accessibilityRole="summary" accessibilityLabel={`Next: ${first.instruction}${first.distanceM ? `, ${formatDistance(first.distanceM)}` : ""}`} style={[raised, { position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18 }]}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" }}><Ionicons name={STEP_ICON[first.kind]} size={22} color={t.onPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: t.font.extrabold, color: t.text }}>{first.instruction}</Text>
              <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>{[first.distanceM ? formatDistance(first.distanceM) : null, r.steps[1] ? `then ${r.steps[1].instruction.toLowerCase()}` : null].filter(Boolean).join(" · ")}</Text>
            </View>
            <Chip>{formatDuration(r.durationSec)}</Chip>
          </Animated.View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>Leaving now · {fromIsHotel ? "from your hotel" : `from ${from.name}`}</Text>
        <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 22, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.4 }}>To {to.name}</Text>
        {r && arrive ? (
          <View accessible accessibilityLabel={`${formatDuration(r.durationSec)}, arrive ${formatTime(arrive, tz)}${r.fare ? `, ${formatMoney(r.fare.amount, r.fare.currency)}` : ""}`} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text><Text style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text }}>{formatDuration(r.durationSec)}</Text><Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>  arrive {formatTime(arrive, tz)}</Text></Text>
            {r.fare ? <Text style={{ fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{formatMoney(r.fare.amount, r.fare.currency)}</Text> : null}
          </View>
        ) : (
          <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Finding routes…</Text>
        )}
        {modes.length > 0 && (
          <View accessibilityRole="radiogroup" accessibilityLabel="Travel mode" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {modes.map((m) => {
              const on = m === mode;
              return (
                <Pressable key={m} accessibilityRole="radio" accessibilityLabel={`${MODE_LABEL[m]}, ${formatDuration(results![m]!.durationSec)}`} accessibilityState={{ checked: on }} onPress={() => pick(m)} style={{ height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? t.primary : t.surfaceTint, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={MODE_ICON[m]} size={16} color={on ? t.onPrimary : t.onTint} />
                  <Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.onTint }}>{formatDuration(results![m]!.durationSec)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {r ? <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{summary}{r.source === "mock" ? " · estimated" : ""}</Text> : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button variant="ink" label="Share ETA" icon={<Ionicons name="share-outline" size={18} color={t.onInk} />} style={{ flex: 1 }} onPress={shareEta} disabled={!r} />
          <Button variant="secondary" label="End" style={{ flex: 1 }} onPress={() => router.back()} />
        </View>
        {shared ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{shared}</Text> : null}

        {r && (
          <>
            <Eyebrow>Steps</Eyebrow>
            <Card>
              {r.steps.map((st, i) => (
                <ListRow key={i} last={i === r.steps.length - 1} leading={<View accessible={false} importantForAccessibility="no" style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: t.surfaceTint, alignItems: "center", justifyContent: "center" }}><Ionicons name={STEP_ICON[st.kind]} size={20} color={t.onTint} /></View>} title={st.instruction} subtitle={[st.durationSec ? formatDuration(st.durationSec) : null, st.distanceM ? formatDistance(st.distanceM) : null, st.detail].filter(Boolean).join(" · ")} accessibilityLabel={`Step ${i + 1} of ${r.steps.length}: ${st.instruction}${st.distanceM ? `, ${formatDistance(st.distanceM)}` : ""}`} />
              ))}
            </Card>
          </>
        )}
        {shortcuts.length > 0 && (
          <>
            <Eyebrow>Instead</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {shortcuts.map((x) => <Button key={x.key} variant="secondary" size="sm" label={x.label} onPress={() => router.setParams({ to: x.place.id })} />)}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
