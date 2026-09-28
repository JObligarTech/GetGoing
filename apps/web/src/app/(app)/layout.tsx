import { redirect } from "next/navigation";
import { activePass, markFor, MOCK_FX_AS_OF } from "@voya/core";
import { AppShell } from "@/components/shell/AppShell";
import { getActiveTrip, getEntitlements, getTripBundle, now } from "@/lib/data";
import { getSessionUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/welcome");
  const trip = await getActiveTrip(user.profile.home_tz);
  const [bundle, entitlements] = await Promise.all([trip ? getTripBundle(trip.id) : null, getEntitlements()]);
  const mark = markFor(activePass(entitlements, trip?.id ?? null, now()));
  // The offline summary the device keeps (mockup 6b): counts only, refreshed on every page while online.
  const offline = trip && bundle ? {
    tripId: trip.id, tripName: trip.name, city: trip.cities[0] ?? trip.name, places: bundle.places.length, routes: bundle.routes.length, phrases: bundle.phrases.length,
    langPack: trip.local_language, fx: trip.local_currency ? { pair: `${user.profile.home_currency} → ${trip.local_currency}`, asOf: MOCK_FX_AS_OF } : null,
  } : null;
  return <AppShell user={{ name: user.profile.display_name, tripName: trip?.name ?? null, mark, offline }}>{children}</AppShell>;
}
