import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { giftStatusLabel, pluralize, travelerGroups } from "@voya/core";
import { PeopleList } from "@/components/people/PeopleList";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { PageHeader } from "@/components/ui/primitives";
import { addTravelerAction, createInviteAction, removeTravelerAction, updateTravelerAction } from "@/app/(app)/people/actions";
import { getTripBundle, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "People" };

/** People on a trip: with and without Get Going accounts, invites, and the groups from tree routes. */
export default async function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const bundle = await getTripBundle(id);
  if (!bundle) notFound();
  const { trip } = bundle;
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href={`/trips/${trip.id}`} variant="secondary" size="sm" aria-label={`Back to ${trip.name}`} icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <PageHeader eyebrow={trip.name} title={`People · ${bundle.travelers.length}`} />
        </div>
        <h2 className="sr-only">{pluralize(bundle.travelers.length, "traveler")}</h2>
        <PeopleList
          trip={trip}
          travelers={bundle.travelers}
          groups={travelerGroups(bundle)}
          userId={user.id}
          userFirstName={user.profile.display_name.split(" ")[0] ?? "A traveler"}
          homeCurrency={user.profile.home_currency}
          pendingInvites={bundle.tripInvites.filter((i) => i.traveler_id && new Date(i.expires_at) > new Date()).map((i) => i.traveler_id!)}
          marks={bundle.passMarks}
          giftNotes={Object.fromEntries(bundle.passGifts.map((g) => [g.traveler_id, giftStatusLabel(g, bundle.travelers.find((t) => t.id === g.traveler_id)?.name.split(" ")[0] ?? "them", now())]))}
          addAction={addTravelerAction}
          updateAction={updateTravelerAction}
          removeAction={removeTravelerAction}
          inviteAction={createInviteAction}
        />
      </FadeIn>
    </Page>
  );
}
