import type { Metadata } from "next";
import { Languages, Landmark, Receipt } from "lucide-react";
import { suggestLanguages } from "@voya/core";
import { Page } from "@/components/shell/Page";
import { Card, Chip, IconCoin, ListRow, PageHeader } from "@/components/ui/primitives";
import { getActiveTrip } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tools" };

/** Tools hub (phone nav): Translate and Currency are live; Split lands in the next round. */
export default async function ToolsPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const pair = suggestLanguages(active, user.profile);
  return (
    <Page>
      <PageHeader eyebrow={active?.name ?? "Tools"} title="Tools" />
      <Card className="divide-y divide-line">
        <ListRow href="/translate" leading={<IconCoin><Languages size={20} /></IconCoin>} title="Translate" subtitle={`${pair.to.native} ready · text, voice, camera`} chevron />
        <ListRow href="/currency" leading={<IconCoin><Landmark size={20} /></IconCoin>} title="Currency" subtitle={active?.local_currency ? `${user.profile.home_currency} ⇄ ${active.local_currency}` : "Set a trip currency"} trailing={<Chip tone="premium">Premium</Chip>} chevron />
        <ListRow href="/split" leading={<IconCoin><Receipt size={20} /></IconCoin>} title="Split" subtitle="Scan a receipt, assign items" trailing={<Chip tone="premium">Premium</Chip>} chevron />
      </Card>
    </Page>
  );
}
