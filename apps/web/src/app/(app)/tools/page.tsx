import type { Metadata } from "next";
import { Languages, Landmark, Receipt } from "lucide-react";
import { activePass, passLabel, suggestLanguages } from "@voya/core";
import { PassChip } from "@/components/ui/PassMark";
import { Page } from "@/components/shell/Page";
import { Card, Chip, IconCoin, ListRow, PageHeader } from "@/components/ui/primitives";
import { getActiveTrip, getEntitlements, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tools" };

/** Tools hub (phone nav): Translate, Currency and Split, with the pass state on the premium rows. */
export default async function ToolsPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const pair = suggestLanguages(active, user.profile);
  const pass = activePass(await getEntitlements(), active?.id ?? null, now());
  const premium = pass ? <PassChip mark={pass.kind === "gift" || pass.kind === "extension" ? "gifted" : "pass"}>{pass.kind === "gift" || pass.kind === "extension" ? passLabel(pass, now()).replace("Gifted · ", "") : "Unlocked"}</PassChip> : <Chip tone="premium">Premium</Chip>;
  return (
    <Page>
      <PageHeader eyebrow={active?.name ?? "Tools"} title="Tools" />
      <Card className="divide-y divide-line">
        <ListRow href="/translate" leading={<IconCoin><Languages size={20} /></IconCoin>} title="Translate" subtitle={`${pair.to.native} ready · text, voice, camera`} chevron />
        <ListRow href="/currency" leading={<IconCoin><Landmark size={20} /></IconCoin>} title="Currency" subtitle={active?.local_currency ? `${user.profile.home_currency} ⇄ ${active.local_currency}` : "Set a trip currency"} trailing={premium} chevron />
        <ListRow href="/split" leading={<IconCoin><Receipt size={20} /></IconCoin>} title="Split" subtitle="Scan a receipt · friends claim by link" trailing={premium} chevron />
      </Card>
    </Page>
  );
}
