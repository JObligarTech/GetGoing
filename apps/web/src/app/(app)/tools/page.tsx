import type { Metadata } from "next";
import { Languages, Landmark, Receipt } from "lucide-react";
import { Page } from "@/components/shell/Page";
import { Card, Chip, IconCoin, ListRow, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Tools" };

/** Tools hub (phone nav). Each tool lands in a later round; the rows are real links so nav is testable now. */
export default function ToolsPage() {
  return (
    <Page>
      <PageHeader eyebrow="Japan 2027" title="Tools" />
      <Card className="divide-y divide-line">
        <ListRow href="/translate" leading={<IconCoin><Languages size={20} /></IconCoin>} title="Translate" subtitle="日本語 ready · text, voice, camera" chevron />
        <ListRow href="/currency" leading={<IconCoin><Landmark size={20} /></IconCoin>} title="Currency" subtitle="USD ⇄ JPY" trailing={<Chip tone="premium">Premium</Chip>} chevron />
        <ListRow href="/split" leading={<IconCoin><Receipt size={20} /></IconCoin>} title="Split" subtitle="Scan a receipt, assign items" trailing={<Chip tone="premium">Premium</Chip>} chevron />
      </Card>
    </Page>
  );
}
