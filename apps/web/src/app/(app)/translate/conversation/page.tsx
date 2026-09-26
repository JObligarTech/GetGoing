import type { Metadata } from "next";
import { suggestLanguages } from "@voya/core";
import { Conversation } from "@/components/translate/Conversation";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { translateAction } from "@/app/(app)/translate/actions";
import { getActiveTrip } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Conversation" };

/** Two-way conversation: one half of the screen faces the other person. */
export default async function ConversationPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  if (!active) return <Page><PageHeader eyebrow="Translate" title="No active trip" /><EmptyState title="Create a trip first" action={<Button href="/trips/new">Create a trip</Button>} /></Page>;
  const pair = suggestLanguages(active, user.profile);
  return <Conversation tripName={active.name} pair={{ from: pair.from.code, to: pair.to.code }} translateAction={translateAction} />;
}
