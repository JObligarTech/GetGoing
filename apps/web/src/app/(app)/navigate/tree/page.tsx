import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { categoriesForPlace, localDate, placeColor, planTree, treeFromDay, treeFromSaved, tripDayNumber } from "@voya/core";
import { categoryColors } from "@voya/tokens";
import { TreeEditor } from "@/components/navigate/tree/TreeEditor";
import { legModesAction, planTreeAction, saveTreeAction } from "@/app/(app)/navigate/tree-actions";
import { getActiveTrip, getTripBundle, now } from "@/lib/data";
import { routing } from "@/lib/routing";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tree route" };

const qs = z.object({ route: z.uuid().optional(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** Navigation tree: groups split, compare, meet again. Editor left (or full-width on phones), map right. */
export default async function TreePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = qs.safeParse(await searchParams);
  if (!q.success) notFound();
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) notFound();
  const tz = active.local_tz ?? user.profile.home_tz;
  const today = localDate(now(), tz);
  const day = q.data.day ?? (tripDayNumber(active, today) ? today : active.start_date ?? today);
  const tree = q.data.route ? treeFromSaved(bundle, q.data.route) : treeFromDay(bundle, day, `Day ${tripDayNumber(active, day) ?? 1} tree`);
  if (!tree) notFound();
  const currency = active.local_currency ?? user.profile.home_currency;
  const plan = tree.stops.length >= 2 ? await planTree(tree, bundle, routing, currency) : null;
  const places = bundle.places.filter((p) => p.lat != null && p.lng != null).map((p) => {
    const isHotel = bundle.stays.some((s) => s.place_id === p.id);
    return { id: p.id, name: p.name, lat: p.lat!, lng: p.lng!, color: isHotel ? categoryColors.stay : placeColor(bundle, p), isHotel, category: categoriesForPlace(bundle, p.id)[0]?.name ?? "Saved" };
  });
  return (
    <TreeEditor
      tripId={active.id}
      tripName={active.name}
      currency={currency}
      initialTree={tree}
      initialPlan={plan}
      places={places}
      travelers={bundle.travelers.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
      planAction={planTreeAction}
      saveAction={saveTreeAction}
      legModesAction={legModesAction}
    />
  );
}
