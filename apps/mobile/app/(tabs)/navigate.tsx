import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { formatDateRange, localDate, MODE_LABEL, navShortcuts, placeById, pluralize, tripDayNumber } from "@voya/core";
import { Card, Chip, EmptyState, Eyebrow, IconCoin, ListRow, PageHeader, Tile, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const ICON = { hotel: "home-outline", dinner: "restaurant-outline", next: "location-outline" } as const;

/** Navigate hub — contextual shortcuts ("Voya already knows") and the trip's saved routes. */
export default function Navigate() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user } = useSession();
  const { now, active, bundle } = useData();
  if (!user) return null;
  if (!active || !bundle) {
    return (
      <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow="Navigate" title="No active trip" />
        <EmptyState title="Create a trip first" body="Navigate uses the hotel and places saved on your trip." />
      </View></View>
    );
  }
  const tz = active.local_tz ?? user.profile.home_tz;
  const today = localDate(now, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const shortcuts = navShortcuts(bundle, day, hhmm);
  const dayNo = tripDayNumber(active, day) ?? 1;
  const stopCount = bundle.itinerary.filter((i) => i.day === day && i.place_id).length;
  const others = bundle.travelers.filter((x) => x.user_id !== user.id).map((x) => x.name).join(", ") || "your travelers";
  const enter = (i: number) => (reduce ? undefined : FadeInDown.duration(220).delay(i * 40));

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <Animated.View entering={enter(0)}>
          <PageHeader eyebrow={active.name} title="Navigate" action={<Chip tone="premium">Atlas Premium Pass</Chip>} />
        </Animated.View>

        <Animated.View entering={enter(1)} style={{ gap: 8 }}>
          <Eyebrow>Shortcuts</Eyebrow>
          <Card>
            {shortcuts.map((sc) => (
              <ListRow key={sc.key} onPress={() => router.push({ pathname: "/navigate/route", params: { to: sc.place.id } })} accessibilityLabel={`${sc.label}: ${sc.place.name}`} leading={<IconCoin name={ICON[sc.key]} />} title={sc.label} subtitle={sc.detail} chevron />
            ))}
            <ListRow onPress={() => router.push({ pathname: "/navigate/day", params: { day } })} leading={<IconCoin name="git-branch-outline" />} title="Navigate the day" subtitle={`Day ${dayNo} · hotel → ${pluralize(stopCount, "stop")} → hotel`} chevron />
            <ListRow leading={<IconCoin name="paper-plane-outline" />} title="Send my location" subtitle={`to ${others}`} trailing={<Chip tone="plain">Next round</Chip>} last />
          </Card>
        </Animated.View>

        <Animated.View entering={enter(2)} style={{ gap: 8 }}>
          <Eyebrow>Saved routes</Eyebrow>
          {bundle.routes.length ? (
            <Card>
              {bundle.routes.map((r, i) => {
                const stops = bundle.routeStops.filter((x) => x.route_id === r.id);
                const first = placeById(bundle, stops[0]?.place_id ?? null), last = placeById(bundle, stops.at(-1)?.place_id ?? null);
                const ends = first && last && first.id !== last.id ? ` · ${first.name.split(" ")[0]} → ${last.name.split(" ")[0]}` : "";
                return (
                  <ListRow key={r.id} last={i === bundle.routes.length - 1} onPress={() => router.push({ pathname: "/navigate/day", params: { route: r.id } })} leading={<Tile name={r.name} size={44} radius={12} invert />} title={r.name} subtitle={`${pluralize(stops.length, "stop")} · ${MODE_LABEL[r.mode]}${ends}`} trailing={r.day ? <Chip tone="plain">{formatDateRange(r.day, null)}</Chip> : undefined} chevron />
                );
              })}
            </Card>
          ) : (
            <EmptyState title="No saved routes yet" body="Navigate a day and save it, or build a route from any place." />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
