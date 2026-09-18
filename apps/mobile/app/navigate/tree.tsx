import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  addBranch, addStop, assignTraveler, branchAt, compareModes, formatClock, formatDistance, formatDuration, formatMoney, initial, localDate, mergeAt, MODE_LABEL, moveStop,
  planTree, removeStop, TRAVEL_MODES, treeFromDay, treeFromSaved, treeSections, tripDayNumber, trunkStops, updateBranch, updateStop,
  type RouteTree, type TravelMode, type TreePlan, type TreeSection, type TreeStop, type Traveler,
} from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { TripMap } from "@/components/MapView";
import { Button, Card, Chip, Dot, EmptyState, Eyebrow, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { routing } from "@/lib/routing";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const MODE_ICON: Record<TravelMode, keyof typeof Ionicons.glyphMap> = { walk: "walk-outline", transit: "train-outline", drive: "car-outline", cycle: "bicycle-outline" };
type Picker = { kind: "after"; stopId: string } | { kind: "lane"; branchId: string | null } | { kind: "merge"; afterStopId: string };

function Avatars({ people, size = 22, ring }: { people: Traveler[]; size?: number; ring: string }) {
  const t = useTheme();
  if (!people.length) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={people.map((p) => p.name.split(" ")[0]).join(", ")} style={{ flexDirection: "row" }}>
      {people.map((p, i) => (
        <View key={p.id} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.color, borderWidth: 2, borderColor: ring, marginLeft: i ? -Math.round(size * 0.3) : 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: Math.round(size * 0.4), fontFamily: t.font.bold }}>{initial(p.name)}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Navigation tree editor: trunk stops everyone shares, split sections with one lane per
 * group, a merge stop where everyone meets. Every edit re-plans on the device.
 */
export default function TreeScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { route: qRoute, day: qDay } = useLocalSearchParams<{ route?: string; day?: string }>();
  const { user } = useSession();
  const { now, active, bundle, saveTree } = useData();
  const tz = active?.local_tz ?? user?.profile.home_tz ?? "UTC";
  const today = localDate(now, tz);
  const day = qDay ?? (active ? (tripDayNumber(active, today) ? today : active.start_date ?? today) : today);
  const currency = active?.local_currency ?? user?.profile.home_currency ?? "USD";

  // The tree is derived from the bundle (which loads async) and the route/day params; edits are kept per seed key.
  const seedKey = bundle ? `${bundle.trip.id}|${qRoute ?? ""}|${day}` : null;
  const built = useMemo<RouteTree | null>(() => {
    if (!bundle) return null;
    return qRoute ? treeFromSaved(bundle, qRoute) : treeFromDay(bundle, day, `Day ${active ? tripDayNumber(active, day) ?? 1 : 1} tree`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);
  const [edits, setEdits] = useState<{ key: string; tree: RouteTree } | null>(null);
  const tree = edits?.key === seedKey ? edits.tree : built;
  const setTree = (next: RouteTree) => { if (seedKey) setEdits({ key: seedKey, tree: next }); };
  const [plan, setPlan] = useState<TreePlan | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useState<"tree" | "map" | "compare">("tree");
  const [picker, setPicker] = useState<Picker | null>(null);
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [saving, setSaving] = useState(false);
  const [durations, setDurations] = useState<{ key: string; by: Partial<Record<TravelMode, number>> } | null>(null);

  useEffect(() => {
    if (!tree || !bundle || trunkStops(tree).length === 0) return;
    let alive = true;
    const h = setTimeout(() => { planTree(tree, bundle, routing, currency).then((p) => { if (alive) setPlan(p); }); }, 200);
    return () => { alive = false; clearTimeout(h); };
  }, [tree, bundle, currency]);

  const sections = useMemo(() => (tree ? treeSections(tree) : []), [tree]);
  const trunk = useMemo(() => (tree ? trunkStops(tree) : []), [tree]);
  const selectedStop = tree?.stops.find((x) => x.id === selected) ?? null;
  const placeOf = (st: TreeStop) => bundle?.places.find((p) => p.id === st.placeId);
  const nameOf = (st: TreeStop) => placeOf(st)?.name ?? "Stop";
  const isHotel = (st: TreeStop) => !!bundle?.stays.some((x) => x.place_id === st.placeId);
  const travelersOf = (ids: string[]) => (bundle?.travelers ?? []).filter((x) => ids.includes(x.id)); // bundle order, like the avatars
  const prevOf = (st: TreeStop): TreeStop | null => {
    if (!tree) return null;
    if (st.branchId) {
      const lane = tree.stops.filter((x) => x.branchId === st.branchId).sort((a, b) => a.sortOrder - b.sortOrder);
      const i = lane.findIndex((x) => x.id === st.id);
      return i > 0 ? lane[i - 1]! : tree.stops.find((x) => x.id === tree.branches.find((b) => b.id === st.branchId)?.splitAfterStopId) ?? null;
    }
    const i = trunk.findIndex((x) => x.id === st.id);
    if (i <= 0) return null;
    return tree.branches.some((b) => b.splitAfterStopId === trunk[i - 1]!.id) ? null : trunk[i - 1]!;
  };
  // Durations by mode for the selected segment (mode picker), computed on device.
  const from = selectedStop ? prevOf(selectedStop) : null;
  const segKey = selectedStop && from ? `${from.placeId}>${selectedStop.placeId}` : null;
  useEffect(() => {
    if (!segKey || !from || !selectedStop || !bundle) return;
    const a = placeOf(from), b = placeOf(selectedStop);
    if (!a || !b || a.lat == null || b.lat == null) return;
    let alive = true;
    compareModes({ lat: a.lat, lng: a.lng! }, { lat: b.lat, lng: b.lng! }, routing, currency).then((r) => {
      if (alive) setDurations({ key: segKey, by: Object.fromEntries(TRAVEL_MODES.filter((m) => r[m]).map((m) => [m, r[m]!.durationSec])) });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey, currency]);

  if (!bundle || !user || !active) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" /></View></View>;
  if (!tree) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Route not found" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;

  const edit = (next: RouteTree, message: string) => { setTree(next); setDirty(true); if (message) announce(message); };
  const legFor = (stopId: string, branchId: string | null) => plan?.legs.find((l) => l.to.id === stopId && l.branchId === branchId) ?? null;
  const select = (st: TreeStop) => { setSelected(st.id); setSheet(true); };
  const canBranch = !!selectedStop && selectedStop.branchId === null && selectedStop.id !== trunk.at(-1)?.id;
  const canMerge = tree.branches.length > 0 && (!selectedStop || selectedStop.branchId === null);
  const onBranch = () => {
    if (!selectedStop || !canBranch) return;
    const next = branchAt(tree, selectedStop.id, bundle.travelers);
    edit(next, `Branched after ${nameOf(selectedStop)} into ${next.branches.filter((b) => b.splitAfterStopId === selectedStop.id).map((b) => b.name).join(" and ")}. Assign travelers from a branch stop.`);
    setView("tree");
  };
  const onMerge = () => {
    const st = selectedStop && selectedStop.branchId === null ? selectedStop : trunk.find((x) => tree.branches.some((b) => b.splitAfterStopId === x.id));
    if (st) { setPicker({ kind: "merge", afterStopId: st.id }); setQuery(""); }
  };
  const onPick = (placeId: string) => {
    if (!picker) return;
    const p = bundle.places.find((x) => x.id === placeId)!;
    if (picker.kind === "merge") edit(mergeAt(tree, picker.afterStopId, placeId), `Everyone meets at ${p.name}.`);
    else if (picker.kind === "after") edit(addStop(tree, placeId, { afterStopId: picker.stopId }), `Added ${p.name}.`);
    else edit(addStop(tree, placeId, { branchId: picker.branchId }), `Added ${p.name}${picker.branchId ? ` to ${tree.branches.find((b) => b.id === picker.branchId)?.name}` : ""}.`);
    setPicker(null);
  };
  const save = async () => {
    setSaving(true); setStatus({});
    const r = await saveTree(tree);
    setSaving(false);
    if ("error" in r) { setStatus({ error: r.error }); announce(r.error); return; }
    const ok = `Saved "${tree.name}".`;
    setStatus({ ok }); setDirty(false); announce(ok);
    if (tree.routeId !== r.id) { setTree({ ...tree, routeId: r.id }); router.setParams({ route: r.id }); }
  };
  const firstSplit = sections.find((x): x is Extract<TreeSection, { kind: "split" }> => x.kind === "split") ?? null;
  const meet = firstSplit?.to ?? null;
  const meetName = meet ? nameOf(meet).split(" ")[0] : "the end";
  const pins = tree.stops.map((st) => { const p = placeOf(st); const b = tree.branches.find((x) => x.id === st.branchId); return p && p.lat != null ? { id: st.id, lat: p.lat, lng: p.lng!, label: isHotel(st) ? "Hotel" : p.name, color: b?.color ?? (isHotel(st) ? categoryColors.stay : t.primary), dark: isHotel(st) } : null; }).filter((x): x is NonNullable<typeof x> => !!x);
  const paths = (plan?.legs ?? []).map((l) => ({ points: l.route.geometry, color: tree.branches.find((b) => b.id === l.branchId)?.color ?? t.primary }));

  // ─── pieces ───────────────────────────────────────────────────────────────
  const modePill = (stopId: string, branchId: string | null, color: string) => {
    const leg = legFor(stopId, branchId);
    return (
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", height: 52, justifyContent: "center" }}>
        <View style={{ width: 2, flex: 1, backgroundColor: color }} />
        <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 7, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name={MODE_ICON[leg?.mode ?? tree.mode]} size={12} color={color} />
          <Text style={{ fontSize: 11, fontFamily: t.font.bold, color: t.text }}>{leg ? `${leg.mode === "transit" ? "Train" : MODE_LABEL[leg.mode]} · ${formatDuration(leg.route.durationSec)}` : "…"}</Text>
        </View>
        <View style={{ width: 2, flex: 1, backgroundColor: color }} />
      </View>
    );
  };
  const node = (st: TreeStop, lane?: { color: string }) => {
    const times = plan?.times[st.id];
    const first = trunk[0]?.id === st.id;
    const dark = !st.branchId && !first;
    const subtitle = first ? `Everyone · leave ${times ? formatClock(times.leave) : "—"}` : st.branchId ? `${times?.arrive ? `Arrive ${formatClock(times.arrive)}` : "…"}${st.dwellMin ? ` · ${formatDuration(st.dwellMin * 60)} there` : ""}` : `Everyone meets · ${times?.arrive ? formatClock(st.plannedTime && st.plannedTime > times.arrive ? st.plannedTime : times.arrive) : "—"}`;
    const leg = legFor(st.id, st.branchId);
    const on = selected === st.id;
    return (
      <Pressable key={st.id} accessibilityRole="button" accessibilityLabel={`${nameOf(st)}: ${subtitle}${leg ? ` · by ${leg.mode}, ${formatDuration(leg.route.durationSec)}` : ""}`} accessibilityState={{ selected: on }} onPress={() => select(st)} style={{ width: "100%", flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, backgroundColor: dark ? t.ink : t.surface, borderWidth: on ? 2 : 1, borderColor: on ? lane?.color ?? t.primary : dark ? t.ink : t.border }}>
        {isHotel(st) && !st.branchId ? (
          <View accessible={false} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: dark ? "rgba(255,255,255,0.15)" : t.ink, alignItems: "center", justifyContent: "center" }}><Ionicons name="home-outline" size={15} color={t.onInk} /></View>
        ) : <Dot color={lane?.color ?? t.primary} size={st.branchId ? 8 : 10} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: t.font.bold, color: dark ? t.onInk : t.text }}>{nameOf(st)}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: dark ? "rgba(255,255,255,0.7)" : t.textMuted, fontFamily: t.font.regular }}>{subtitle}</Text>
        </View>
        {!st.branchId && <Avatars people={bundle.travelers} ring={dark ? t.ink : t.surface} />}
      </Pressable>
    );
  };
  const fork = (colors: string[], dir: "split" | "merge") => (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ height: 34, justifyContent: dir === "split" ? "flex-start" : "flex-end" }}>
      <View style={{ position: "absolute", left: "50%", marginLeft: -1, top: dir === "split" ? 0 : undefined, bottom: dir === "merge" ? 0 : undefined, width: 2, height: 12, backgroundColor: t.text }} />
      <View style={{ position: "absolute", top: dir === "split" ? 12 : undefined, bottom: dir === "merge" ? 12 : undefined, left: `${50 / colors.length}%`, right: `${50 / colors.length}%`, height: 2, backgroundColor: t.border }} />
      {colors.map((c, i) => (
        <View key={i} style={{ position: "absolute", left: `${((i + 0.5) * 100) / colors.length}%`, marginLeft: -1, top: dir === "split" ? 12 : 0, bottom: dir === "merge" ? 12 : 0, width: 2, backgroundColor: c }} />
      ))}
      <View style={{ position: "absolute", left: "50%", marginLeft: -5, top: dir === "split" ? 7 : undefined, bottom: dir === "merge" ? 7 : undefined, width: 10, height: 10, borderRadius: 5, backgroundColor: t.surface, borderWidth: 2, borderColor: t.text }} />
    </View>
  );

  const treeView = (
    <View accessibilityRole="list" accessibilityLabel="Route tree" style={{ gap: 0 }}>
      {sections.map((sec, idx) => {
        if (sec.kind === "stop") {
          const prev = sections[idx - 1];
          return (
            <View key={sec.stop.id} style={{ alignItems: "center" }}>
              {idx > 0 && prev?.kind === "stop" && modePill(sec.stop.id, null, t.primary)}
              <View style={{ width: "100%", maxWidth: 300 }}>{node(sec.stop)}</View>
            </View>
          );
        }
        const colors = sec.lanes.map((l) => l.branch.color);
        return (
          <View key={`split-${sec.from.id}`}>
            {fork(colors, "split")}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {sec.lanes.map((lane, li) => {
                const people = travelersOf(lane.branch.travelerIds);
                return (
                  <View key={lane.branch.id} accessible={false} accessibilityLabel={`${lane.branch.name}: ${people.length ? people.map((p) => p.name.split(" ")[0]).join(", ") : "no travelers yet"}`} style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
                    <View accessible accessibilityRole="header" accessibilityLabel={`${lane.branch.name}: ${people.length ? people.map((p) => p.name.split(" ")[0]).join(", ") : "no travelers yet"}`} style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.surfaceTint, borderWidth: 1.5, borderColor: lane.branch.color, flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Dot color={lane.branch.color} size={8} /><Text style={{ fontSize: 11.5, fontFamily: t.font.extrabold, color: t.onTint, textTransform: "uppercase" }}>{lane.branch.name}</Text><Avatars people={people} size={18} ring={t.surfaceTint} />
                    </View>
                    {lane.stops.map((st) => (
                      <View key={st.id} style={{ width: "100%", alignItems: "center" }}>
                        {modePill(st.id, lane.branch.id, lane.branch.color)}
                        {node(st, { color: lane.branch.color })}
                      </View>
                    ))}
                    <View accessible={false} style={{ width: 2, height: 36, backgroundColor: lane.branch.color }} />
                    <Pressable accessibilityRole="button" accessibilityLabel={`Add stop to ${lane.branch.name}`} onPress={() => { setPicker({ kind: "lane", branchId: lane.branch.id }); setQuery(""); }} style={{ width: "100%", minHeight: 44, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.borderStrong, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
                      <Ionicons name="add" size={14} color={t.textMuted} /><Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: t.textMuted }}>Add stop</Text>
                    </Pressable>
                    {li === sec.lanes.length - 1 && sec.lanes.length < 4 && (
                      <Pressable accessibilityRole="button" onPress={() => edit(addBranch(tree, sec.from.id), "Added a branch.")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.primary }}>+ another group</Text></Pressable>
                    )}
                  </View>
                );
              })}
            </View>
            {sec.to ? fork(colors, "merge") : (
              <View style={{ alignItems: "center", marginTop: 8 }}><Button variant="secondary" size="sm" label="Meet again at…" onPress={() => { setPicker({ kind: "merge", afterStopId: sec.from.id }); setQuery(""); }} /></View>
            )}
          </View>
        );
      })}
    </View>
  );

  const compareView = !plan || plan.lanes.length === 0 ? (
    <EmptyState title="Add a branch to compare the groups" />
  ) : (
    <View style={{ gap: 14 }}>
      {plan.lanes.map((l) => {
        const people = travelersOf(l.branch.travelerIds);
        const first = tree.stops.filter((x) => x.branchId === l.branch.id).sort((a, b) => a.sortOrder - b.sortOrder)[0];
        const label = `${l.branch.name}: ${formatDuration(l.doorToDoorSec)} door to ${meetName}. Travel ${formatDuration(l.travelSec)}, walking ${formatDistance(l.walkM)}, fares ${l.fares ? `${formatMoney(l.fares.amount, l.fares.currency)} per person` : "none"}, ${l.transfers} transfers, at ${meetName} ${l.arrive ? formatClock(l.arrive) : "unknown"}.`;
        return (
          <Card key={l.branch.id} style={{ padding: 14, gap: 10, borderTopWidth: 3, borderTopColor: l.branch.color }}>
            <View accessible accessibilityLabel={label} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Dot color={l.branch.color} size={8} /><Eyebrow>{l.branch.name}</Eyebrow></View>
                <Avatars people={people} ring={t.surface} />
              </View>
              <Text><Text style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text }}>{formatDuration(l.doorToDoorSec)}</Text><Text style={{ fontSize: 12.5, color: t.textMuted }}>  Door to {meetName}</Text></Text>
              {[["Travel", formatDuration(l.travelSec)], ["Walking", formatDistance(l.walkM)], ["Fares", l.fares ? `${formatMoney(l.fares.amount, l.fares.currency)} pp` : formatMoney(0, currency)], ["Transfers", String(l.transfers)], [`At ${meetName}`, l.arrive ? formatClock(l.arrive) : "—"]].map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontSize: 13, color: t.textMuted }}>{k}</Text><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.text }}>{v}</Text></View>
              ))}
              <Text style={{ fontSize: 12, color: t.textMuted }}>{l.chain}</Text>
            </View>
            {first && <Button variant="ink" size="sm" label={`Start ${l.branch.name}`} onPress={() => router.push({ pathname: "/navigate/route", params: { to: first.placeId, mode: first.mode ?? tree.mode } })} />}
          </Card>
        );
      })}
      {plan.insight ? <View accessible accessibilityRole="text" style={{ flexDirection: "row", gap: 10, backgroundColor: t.surfaceTint, borderRadius: 12, padding: 14 }}><Ionicons name="bulb-outline" size={18} color={t.onTint} /><Text style={{ flex: 1, fontSize: 13, color: t.onTint, fontFamily: t.font.semibold, lineHeight: 18 }}>{plan.insight}</Text></View> : null}
      {plan.unassignedTravelerIds.length > 0 && <Text style={{ fontSize: 13, color: t.textMuted }}>Not on a branch yet: {travelersOf(plan.unassignedTravelerIds).map((p) => p.name.split(" ")[0]).join(", ")}. Open a branch stop to assign them.</Text>}
      {plan.lanes.filter((l) => l.alternatives.length).map((l) => (
        <View key={l.branch.id} style={{ gap: 8 }}>
          <Eyebrow>Alternatives for {l.branch.name}</Eyebrow>
          <Card>
            {l.alternatives.map((a, i) => (
              <Pressable key={a.mode} accessibilityRole="button" accessibilityLabel={`${a.label}, ${a.deltaSec >= 0 ? "plus" : "minus"} ${formatDuration(Math.abs(a.deltaSec))}`} onPress={() => {
                const lane = tree.stops.filter((x) => x.branchId === l.branch.id).sort((p, q) => p.sortOrder - q.sortOrder);
                const target = lane[a.legIndex];
                edit(target ? updateStop(tree, target.id, { mode: a.mode }) : updateBranch(tree, l.branch.id, { mergeMode: a.mode }), `${l.branch.name} now ${a.mode === "walk" ? "walks" : "drives"} that segment.`);
              }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: i === l.alternatives.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.surfaceTint, alignItems: "center", justifyContent: "center" }}><Ionicons name={MODE_ICON[a.mode]} size={18} color={t.onTint} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontFamily: t.font.bold, color: t.text }}>{a.label}</Text><Text style={{ fontSize: 12, color: t.textMuted }}>{a.deltaSec >= 0 ? "+" : "−"}{formatDuration(Math.abs(a.deltaSec))}{a.fare ? ` · ${formatMoney(a.fare.amount, a.fare.currency)}` : a.mode === "walk" ? ` · ${formatMoney(0, currency)}` : ""}</Text></View>
                <Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.primary }}>Use</Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
      <Button variant="ink" label="Share comparison" icon={<Ionicons name="share-outline" size={18} color={t.onInk} />} onPress={() => Share.share({ message: `${tree.name}: ${plan.lanes.map((l) => `${l.branch.name} ${formatDuration(l.doorToDoorSec)} door to ${meetName}, at ${meetName} ${l.arrive ? formatClock(l.arrive) : "—"}`).join("; ")}${plan.insight ? `. ${plan.insight}` : ""}` }).catch(() => {})} />
    </View>
  );

  // Segment sheet content
  const sheetBody = selectedStop && (() => {
    const st = selectedStop;
    const branch = tree.branches.find((b) => b.id === st.branchId) ?? null;
    const siblings = branch ? tree.branches.filter((b) => b.splitAfterStopId === branch.splitAfterStopId && b.id !== branch.id) : [];
    const ti = trunk.findIndex((x) => x.id === st.id);
    const merging = !branch && ti > 0 ? tree.branches.filter((b) => b.splitAfterStopId === trunk[ti - 1]!.id) : [];
    const times = plan?.times[st.id];
    const lane = tree.stops.filter((x) => x.branchId === st.branchId).sort((a, b) => a.sortOrder - b.sortOrder);
    const li = lane.findIndex((x) => x.id === st.id);
    const by = durations?.key === segKey ? durations.by : {};
    const modeRow = (current: TravelMode | null, label: string, pick: (m: TravelMode) => void) => (
      <View style={{ gap: 8 }}>
        <Eyebrow>{label}</Eyebrow>
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {TRAVEL_MODES.map((m) => {
            const on = (current ?? tree.mode) === m;
            const sec = by[m];
            return (
              <Pressable key={m} accessibilityRole="radio" accessibilityLabel={`${MODE_LABEL[m]}${sec != null ? `, ${formatDuration(sec)}` : ""}`} accessibilityState={{ checked: on }} onPress={() => pick(m)} style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? t.primary : t.surfaceTint, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name={MODE_ICON[m]} size={16} color={on ? t.onPrimary : t.onTint} /><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.onTint }}>{MODE_LABEL[m]}{sec != null ? ` · ${formatDuration(sec)}` : ""}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
    return (
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.medium }}>Segment · {branch ? `${branch.name} branch` : "Everyone"}</Text>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>{from ? `${nameOf(from)} → ${nameOf(st)}` : nameOf(st)}</Text>
          {times ? <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{times.arrive ? `Arrives ${formatClock(times.arrive)}` : "Start"} · leaves {formatClock(times.leave)}</Text> : null}
        </View>
        {branch && (
          <View style={{ gap: 6 }}>
            <Eyebrow>Who&apos;s on this branch</Eyebrow>
            {bundle.travelers.map((p) => {
              const on = branch.travelerIds.includes(p.id);
              const elsewhere = siblings.find((b) => b.travelerIds.includes(p.id));
              return (
                <Pressable key={p.id} accessibilityRole="checkbox" accessibilityLabel={`${p.name.split(" ")[0]}${elsewhere && !on ? `, on ${elsewhere.name}` : ""}`} accessibilityState={{ checked: on }} onPress={() => edit(assignTraveler(tree, branch.id, p.id, !on), `${p.name.split(" ")[0]} ${!on ? "joins" : "leaves"} ${branch.name}.`)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 6 }}>
                  <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? t.primary : t.textFaint} />
                  <Avatars people={[p]} ring={t.canvas} />
                  <Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{p.name.split(" ")[0]}</Text>
                  {elsewhere && !on ? <Chip tone="plain">· {elsewhere.name.replace("Group ", "")}</Chip> : null}
                </Pressable>
              );
            })}
          </View>
        )}
        {from && merging.length === 0 && modeRow(st.mode, "Mode for this segment", (m) => edit(updateStop(tree, st.id, { mode: m }), `${MODE_LABEL[m]} selected.`))}
        {merging.map((b) => <View key={b.id}>{modeRow(b.mergeMode, `${b.name} arrives by`, (m) => edit(updateBranch(tree, b.id, { mergeMode: m }), `${b.name} arrives by ${MODE_LABEL[m].toLowerCase()}.`))}</View>)}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text nativeID="tree-time-label" style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>{from ? "Planned time" : "Depart at"}</Text>
            <TextInput accessibilityLabel={from ? "Planned time" : "Depart at"} accessibilityLabelledBy="tree-time-label" value={st.plannedTime ?? ""} placeholder="HH:MM" placeholderTextColor={t.textFaint} onChangeText={(v) => { if (v === "" || /^\d{2}:\d{2}$/.test(v)) edit(updateStop(tree, st.id, { plannedTime: v || null }), ""); }} maxLength={5} keyboardType="numbers-and-punctuation" style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular }} />
          </View>
          {from && (
            <View style={{ flex: 1, gap: 6 }}>
              <Text nativeID="tree-dwell-label" style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>Time there (min)</Text>
              <TextInput accessibilityLabel="Time there (min)" accessibilityLabelledBy="tree-dwell-label" value={st.dwellMin == null ? "" : String(st.dwellMin)} onChangeText={(v) => edit(updateStop(tree, st.id, { dwellMin: v === "" ? null : Math.max(0, Math.min(1440, Number(v) || 0)) }), "")} keyboardType="number-pad" style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular }} />
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button variant="secondary" size="sm" label="Move up" disabled={li <= 0} onPress={() => edit(moveStop(tree, st.id, -1), `${nameOf(st)} moved to stop ${li} of ${lane.length}`)} />
          <Button variant="secondary" size="sm" label="Move down" disabled={li >= lane.length - 1} onPress={() => edit(moveStop(tree, st.id, 1), `${nameOf(st)} moved to stop ${li + 2} of ${lane.length}`)} />
          <Button variant="secondary" size="sm" label="Remove stop" onPress={() => { edit(removeStop(tree, st.id), `Removed ${nameOf(st)}.`); setSelected(null); setSheet(false); }} />
          <Button size="sm" label="Done" onPress={() => setSheet(false)} />
        </View>
      </View>
    );
  })();

  const pickerPlaces = bundle.places.filter((p) => p.lat != null && p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Navigate" onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}><Ionicons name="chevron-back" size={24} color={t.text} /></Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.medium }}>Tree route{tree.day ? ` · ${tree.day}` : ""}</Text>
            <TextInput accessibilityLabel="Route name" value={tree.name} onChangeText={(v) => edit({ ...tree, name: v }, "")} maxLength={120} style={{ fontSize: 22, fontFamily: t.font.extrabold, color: t.text, padding: 0 }} />
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="View" style={{ flexDirection: "row", backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, padding: 3 }}>
            {(["tree", "map"] as const).map((v) => (
              <Pressable key={v} accessibilityRole="radio" accessibilityLabel={v === "tree" ? "Tree" : "Map"} accessibilityState={{ checked: view === v }} onPress={() => setView(v)} style={{ height: 30, paddingHorizontal: 12, borderRadius: 7, backgroundColor: view === v ? t.primary : "transparent", justifyContent: "center" }}><Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: view === v ? t.onPrimary : t.textMuted }}>{v === "tree" ? "Tree" : "Map"}</Text></Pressable>
            ))}
          </View>
        </View>
        {plan?.endsAt ? <Text style={{ fontSize: 12.5, color: t.textMuted }}>Everyone back together by {formatClock(plan.endsAt)}{plan.estimated ? " · times are estimates" : ""}</Text> : null}

        {view === "map" ? (
          <TripMap interactive center={{ lat: 35.672, lng: 139.702 }} zoom={13} pins={pins} paths={paths} label={`Map of ${tree.name}: ${tree.stops.map(nameOf).join(", ")}`} style={{ height: 420, borderRadius: 18, borderWidth: 1, borderColor: t.border }} />
        ) : view === "compare" ? compareView : treeView}

        <View accessibilityRole="toolbar" accessibilityLabel="Edit tree" style={{ flexDirection: "row", gap: 8 }}>
          <Button variant="secondary" size="sm" label="Branch" icon={<Ionicons name="git-branch-outline" size={16} color={t.text} />} disabled={!canBranch} onPress={onBranch} style={{ flex: 1, paddingHorizontal: 8 }} />
          <Button variant="secondary" size="sm" label="Merge" icon={<Ionicons name="git-merge-outline" size={16} color={t.text} />} disabled={!canMerge} onPress={onMerge} style={{ flex: 1, paddingHorizontal: 8 }} />
          <Button variant="secondary" size="sm" label="Add" accessibilityLabel="Add stop" icon={<Ionicons name="add" size={16} color={t.text} />} onPress={() => { setPicker(selectedStop ? { kind: "after", stopId: selectedStop.id } : { kind: "lane", branchId: null }); setQuery(""); }} style={{ flex: 1, paddingHorizontal: 8 }} />
          <Button size="sm" label="Compare" accessibilityState={{ selected: view === "compare" }} onPress={() => setView(view === "compare" ? "tree" : "compare")} style={{ flex: 1.3, paddingHorizontal: 8 }} />
        </View>

        <Card style={{ padding: 14, gap: 10 }}>
          {status.error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{status.error}</Text> : null}
          {status.ok ? <Text accessibilityLiveRegion="polite" style={{ color: t.primary, fontSize: 13, fontFamily: t.font.semibold }}>{status.ok}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Button label={tree.routeId ? "Save changes" : "Save tree route"} size="cta" style={{ flex: 1 }} onPress={save} disabled={saving || (!dirty && !!tree.routeId)} />
            {dirty ? <Chip tone="plain">Unsaved</Chip> : null}
          </View>
        </Card>
      </ScrollView>

      <Modal visible={sheet && !!sheetBody} transparent animationType="slide" onRequestClose={() => setSheet(false)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setSheet(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <ScrollView style={{ maxHeight: "80%", backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>{sheetBody}</ScrollView>
      </Modal>

      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Cancel" accessibilityRole="button" onPress={() => setPicker(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ maxHeight: "75%", backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>{picker?.kind === "merge" ? "Where does everyone meet?" : "Add a stop"}</Text>
          <TextInput accessibilityLabel="Search saved places" value={query} onChangeText={setQuery} placeholder="Shibuya…" placeholderTextColor={t.textFaint} style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular }} />
          <ScrollView>
            <Card>
              {pickerPlaces.map((p, i) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Add ${p.name}`} onPress={() => onPick(p.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderBottomWidth: i === pickerPlaces.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                  <Dot color={bundle.stays.some((x) => x.place_id === p.id) ? categoryColors.stay : t.primary} /><Text style={{ flex: 1, fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{p.name}</Text><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.primary }}>Add</Text>
                </Pressable>
              ))}
              {pickerPlaces.length === 0 && <Text style={{ padding: 14, fontSize: 13, color: t.textMuted }}>No saved place matches.</Text>}
            </Card>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

