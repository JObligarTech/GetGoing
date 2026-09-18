import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { LinearTransition, useReducedMotion } from "react-native-reanimated";
import {
  dayStops, dayTimeline, formatDateRange, formatDistance, formatDuration, formatMoney, localDate, MODE_LABEL, moveItem, placeById, placeColor,
  routeDay, tripDayNumber, type DayRoute, type DayStop, type TravelMode,
} from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { TripMap } from "@/components/MapView";
import { Button, Card, Chip, Dot, EmptyState, Tile, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { routing } from "@/lib/routing";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const DAY_MODES: TravelMode[] = ["walk", "transit"];

/**
 * Multi-stop route: hotel → the day's places → hotel, or a saved route. Totals, a
 * reorderable stop list (move up/down buttons announce the new position), walk/transit,
 * and "Save route".
 */
export default function DayRouteScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { day: qDay, route: qRoute } = useLocalSearchParams<{ day?: string; route?: string }>();
  const { user } = useSession();
  const { now, active, bundle, saveRoute } = useData();

  const tz = active?.local_tz ?? user?.profile.home_tz ?? "UTC";
  const today = localDate(now, tz);
  const saved = qRoute && bundle ? bundle.routes.find((r) => r.id === qRoute) ?? null : null;
  const day = saved?.day ?? qDay ?? (active ? (tripDayNumber(active, today) ? today : active.start_date ?? today) : today);
  const currency = active?.local_currency ?? user?.profile.home_currency ?? "USD";

  const baseStops = useMemo<DayStop[]>(() => {
    if (!bundle) return [];
    if (saved) {
      return bundle.routeStops.filter((x) => x.route_id === saved.id).sort((a, b) => a.sort_order - b.sort_order).flatMap((x) => {
        const p = placeById(bundle, x.place_id);
        if (!p || p.lat == null) return [];
        const isHotel = bundle.stays.some((st) => st.place_id === p.id);
        return [{ place: p, item: null, time: x.planned_time?.slice(0, 5) ?? null, color: isHotel ? categoryColors.stay : placeColor(bundle, p), isHotel }];
      });
    }
    return dayStops(bundle, day);
  }, [bundle, saved, day]);

  const [order, setOrder] = useState<string[] | null>(null); // reordered middle ids
  const [mode, setMode] = useState<TravelMode>(saved && DAY_MODES.includes(saved.mode) ? saved.mode : "walk");
  const [plan, setPlan] = useState<DayRoute | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [saving, setSaving] = useState(false);

  const stops = useMemo(() => {
    if (!order || baseStops.length < 3) return baseStops;
    const middle = baseStops.slice(1, -1);
    const re = order.map((id) => middle.find((x) => x.place.id === id)).filter((x): x is DayStop => !!x);
    return re.length === middle.length ? [baseStops[0]!, ...re, baseStops.at(-1)!] : baseStops;
  }, [baseStops, order]);

  useEffect(() => {
    if (stops.length < 2) return;
    let alive = true;
    routeDay(stops, routing, mode, currency).then((p) => { if (alive) setPlan(p); });
    return () => { alive = false; };
  }, [stops, mode, currency]);

  if (!bundle || !user || !active) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" /></View></View>;
  if (qRoute && !saved) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Route not found" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  if (stops.length < 2) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Nothing to route yet" body="Add places to this day in Plan, then navigate it." action={<Button label="Open Plan" variant="secondary" onPress={() => router.push({ pathname: "/plan", params: { day } })} />} /></View></View>;

  const dayNo = tripDayNumber(active, day) ?? 1;
  const title = saved?.name ?? `Day ${dayNo} route`;
  const rows = plan ? dayTimeline(plan) : null;
  const middle = stops.slice(1, -1);
  const locked = !!saved;
  const pins = stops.map((x, i) => ({ id: `${x.place.id}-${i}`, lat: x.place.lat!, lng: x.place.lng!, label: x.isHotel ? (i === 0 ? "Hotel" : undefined) : x.place.name, color: x.color, dark: x.isHotel }));
  const path = plan?.legs.flatMap((l) => l.route.geometry);
  const raised = { backgroundColor: t.surfaceRaised, borderRadius: 12, shadowColor: "#000", shadowOpacity: t.scheme === "dark" ? 0.4 : 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 };

  const move = (i: number, delta: number) => {
    const next = moveItem(middle, i, i + delta);
    if (next === middle) return;
    setOrder(next.map((x) => x.place.id));
    announce(`${middle[i]!.place.name} moved to stop ${i + delta + 1} of ${middle.length}`);
  };
  const save = async () => {
    if (!rows) return;
    setSaving(true); setStatus({});
    const res = await saveRoute({ name: name.trim() || `Day ${dayNo} · ${stops[1]?.place.name.split(" ")[0] ?? "route"}`, day, mode, stops: rows.map((r) => ({ placeId: r.stop.place.id, plannedTime: r.arrive ?? r.leave })) });
    setSaving(false);
    if ("error" in res) { setStatus({ error: res.error }); announce(res.error); }
    else { const msg = `Saved "${name.trim() || `Day ${dayNo}`}" to your routes.`; setStatus({ ok: msg }); announce(msg); }
  };

  return (
    <View style={s.screen}>
      <View style={{ height: 260 + insets.top }}>
        <TripMap interactive center={{ lat: 35.672, lng: 139.702 }} zoom={13} pins={pins} path={path} label={`Map of ${title}: ${stops.map((x) => x.place.name).join(" → ")}`} style={{ flex: 1 }} />
        <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Navigate" onPress={() => router.back()} style={[raised, { width: 44, height: 44, alignItems: "center", justifyContent: "center" }]}><Ionicons name="chevron-back" size={22} color={t.text} /></Pressable>
          <View style={[raised, { height: 44, paddingHorizontal: 14, justifyContent: "center" }]}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.textMuted }}>{plan ? formatDuration(plan.totalSec) : "…"}</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{saved ? "Saved route" : "Multi-stop route"} · {formatDateRange(day, null)}</Text>
            <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 22, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.4 }}>{title}</Text>
          </View>
          {saved && <Chip>{MODE_LABEL[saved.mode]}</Chip>}
        </View>

        <View accessible accessibilityLabel={plan ? `Route totals: ${formatDuration(plan.totalSec, true)} total, ${formatDistance(plan.walkM)} on foot, fares ${plan.fares ? formatMoney(plan.fares.amount, plan.fares.currency) : "none"}` : "Calculating route totals"} style={{ flexDirection: "row", gap: 8 }}>
          {[["Total", plan ? formatDuration(plan.totalSec, true) : "…"], ["On foot", plan ? formatDistance(plan.walkM) : "…"], ["Fares", plan?.fares ? formatMoney(plan.fares.amount, plan.fares.currency) : "—"]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ fontSize: 11, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{k}</Text>
              <Text style={{ fontSize: 16, fontFamily: t.font.extrabold, color: t.text }}>{v}</Text>
            </View>
          ))}
        </View>

        {!locked && (
          <View accessibilityRole="radiogroup" accessibilityLabel="Travel mode" style={{ flexDirection: "row", gap: 4, alignSelf: "flex-start", backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, padding: 4 }}>
            {DAY_MODES.map((m) => {
              const on = m === mode;
              return (
                <Pressable key={m} accessibilityRole="radio" accessibilityLabel={MODE_LABEL[m]} accessibilityState={{ checked: on }} onPress={() => { setMode(m); announce(`${MODE_LABEL[m]} selected`); }} style={{ height: 32, paddingHorizontal: 12, borderRadius: 9, backgroundColor: on ? t.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.textMuted }}>{MODE_LABEL[m]}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Card>
          {stops.map((x, idx) => {
            const i = idx - 1;
            const row = rows?.[idx];
            const canMove = !locked && !x.isHotel;
            const legText = row?.leg ? `${formatDuration(row.leg.route.durationSec)} · ${formatDistance(row.leg.route.distanceM)}${row.leg.route.fare ? ` · ${formatMoney(row.leg.route.fare.amount, row.leg.route.fare.currency)}` : ""}` : "";
            const timing = idx === 0 ? `Leave ${row?.leave ?? "…"}` : `Arrive ${row?.arrive ?? "…"}${legText ? ` · ${legText}` : ""}`;
            const label = x.isHotel ? (idx === 0 ? x.place.name : "Back to hotel") : x.place.name;
            return (
              <Animated.View key={`${x.place.id}-${idx}`} layout={reduce ? undefined : LinearTransition.duration(200)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: idx === stops.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                <View accessible accessibilityLabel={`Stop ${idx + 1} of ${stops.length}: ${label}. ${timing}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {x.isHotel ? (
                    <View accessible={false} importantForAccessibility="no" style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.surfaceTint, alignItems: "center", justifyContent: "center" }}><Ionicons name="home-outline" size={18} color={t.onTint} /></View>
                  ) : (
                    <Tile name={String(i + 1)} size={36} radius={10} color={x.color} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>{label}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{timing}</Text>
                  </View>
                  {!x.isHotel && <Dot color={x.color} size={8} />}
                </View>
                {canMove && (
                  <View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move ${x.place.name} up`} accessibilityState={{ disabled: i === 0 }} disabled={i === 0} onPress={() => move(i, -1)} style={{ width: 36, height: 26, alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.3 : 1 }}><Ionicons name="chevron-up" size={18} color={t.textMuted} /></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move ${x.place.name} down`} accessibilityState={{ disabled: i === middle.length - 1 }} disabled={i === middle.length - 1} onPress={() => move(i, 1)} style={{ width: 36, height: 26, alignItems: "center", justifyContent: "center", opacity: i === middle.length - 1 ? 0.3 : 1 }}><Ionicons name="chevron-down" size={18} color={t.textMuted} /></Pressable>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </Card>

        {!locked && (
          <Card style={{ padding: 14, gap: 10 }}>
            {status.error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{status.error}</Text> : null}
            {status.ok ? <Text accessibilityLiveRegion="polite" style={{ color: t.primary, fontSize: 13, fontFamily: t.font.semibold }}>{status.ok}</Text> : null}
            <Text nativeID="route-name-label" style={{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted }}>Route name</Text>
            <TextInput accessibilityLabel="Route name" accessibilityLabelledBy="route-name-label" value={name} onChangeText={setName} placeholder={`Day ${dayNo} · ${stops[1]?.place.name.split(" ")[0] ?? "route"}`} placeholderTextColor={t.textFaint} maxLength={120} style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular, fontSize: 15 }} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label="Save route" size="cta" style={{ flex: 1 }} onPress={save} disabled={saving || !rows} />
              <Button label="Start" variant="ink" size="cta" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/navigate/route", params: { to: middle[0]?.place.id ?? "", mode } })} />
            </View>
          </Card>
        )}
        {plan?.legs.some((l) => l.route.source === "mock") && <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>Times are estimates; live transit arrives with a routing provider.</Text>}
      </ScrollView>
    </View>
  );
}
