import type { Metadata } from "next";
import { z } from "zod";
import { contextPhrases, localDate, phrasesForTrip, suggestLanguages, tripDayNumber } from "@voya/core";
import { Translator } from "@/components/translate/Translator";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { removePhraseAction, savePhraseAction, translateAction } from "@/app/(app)/translate/actions";
import { getActiveTrip, getTripBundle, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Translate" };

const qs = z.object({ text: z.string().max(500).optional() });

/** Translate hub: text mode with the trip's language suggested, saved phrases and "From your trip". */
export default async function TranslatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = qs.safeParse(await searchParams);
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) {
    return <Page><PageHeader eyebrow="Translate" title="No active trip" /><EmptyState title="Create a trip first" body="Translate suggests the trip's language and keeps saved phrases with the trip." action={<Button href="/trips/new">Create a trip</Button>} /></Page>;
  }
  const pair = suggestLanguages(active, user.profile);
  const tz = active.local_tz ?? user.profile.home_tz;
  const at = now();
  const today = localDate(at, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return (
    <Translator
      tripId={active.id}
      tripName={active.name}
      pair={{ from: pair.from.code, to: pair.to.code, reason: pair.reason }}
      phrases={phrasesForTrip(bundle)}
      context={contextPhrases(bundle, day, hhmm)}
      initialText={q.success ? q.data.text ?? "" : ""}
      translateAction={translateAction}
      savePhraseAction={savePhraseAction}
      removePhraseAction={removePhraseAction}
    />
  );
}
