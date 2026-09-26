import type { Metadata } from "next";
import { countryName, tripCurrencies, type CachedRate } from "@voya/core";
import { Converter } from "@/components/currency/Converter";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { addTripCurrencyAction, rateAction, removeTripCurrencyAction } from "@/app/(app)/currency/actions";
import { getActiveTrip, getTripBundle, now } from "@/lib/data";
import { fx } from "@/lib/providers";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Currency" };

/** Currency: home currency → the trip's local currency, with quick amounts, a keypad and cached rates. */
export default async function CurrencyPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) {
    return <Page><PageHeader eyebrow="Currency" title="No active trip" /><EmptyState title="Create a trip first" body="Currency converts to the trip's local currency by default." action={<Button href="/trips/new">Create a trip</Button>} /></Page>;
  }
  const home = user.profile.home_currency;
  const local = active.local_currency;
  const chips = tripCurrencies(bundle);
  const quote = local ?? chips[0]?.code ?? "EUR";
  let initialRate: CachedRate | null = null;
  try { initialRate = await fx.rate(home, quote); } catch { initialRate = null; }
  return (
    <Converter
      tripId={active.id}
      tripName={active.name}
      countryName={countryName(active.countries[0] ?? null)}
      homeCurrency={home}
      localCurrency={local}
      tripCurrencies={chips}
      extras={bundle.tripCurrencies}
      initialRate={initialRate}
      nowIso={now().toISOString()}
      rateAction={rateAction}
      addCurrencyAction={addTripCurrencyAction}
      removeCurrencyAction={removeTripCurrencyAction}
    />
  );
}
