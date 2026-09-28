import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Permissions } from "@/components/settings/Permissions";
import { DeleteAccountButton } from "@/components/profile/DeleteAccountButton";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, ListRow, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { deleteAccount } from "@/app/auth/actions";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Permissions & legal" };

/** Permissions & legal (mockup 7a): each capability's state with denied-state recovery, the legal docs, your data. */
export default async function PermissionsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await requireUser();
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href="/settings" variant="secondary" size="sm" aria-label="Back to Settings" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <PageHeader eyebrow="Settings" title="Permissions" />
        </div>
        <p className="text-[13.5px] text-muted">Get Going asks for each of these the first time a feature needs it. Turn them on or off here or in your browser&apos;s site settings.</p>
        <Card className="divide-y divide-line"><Permissions /></Card>

        <SectionHeader title="Legal" />
        <Card className="divide-y divide-line">
          <ListRow href="/legal/terms" title="Terms of Service" chevron />
          <ListRow href="/legal/privacy" title="Privacy Policy" chevron />
          <ListRow href="/legal/refunds" title="Refund Policy" chevron />
          <ListRow href="/legal/cookies" title="Cookie Policy" chevron />
          <ListRow href="/legal/licences" title="Licences & credits" chevron />
        </Card>

        <SectionHeader title="Your data" />
        <Card className="flex flex-col gap-2 px-3.5 py-3">
          {error === "delete" && <p role="alert" className="text-[13px] font-semibold text-danger">Couldn&apos;t delete the account. Try again.</p>}
          <p className="text-[15px] font-semibold">Download or delete my data</p>
          <p className="text-[12px] text-muted">Trips, places, receipts, translations. Export is a JSON file of everything in your account. Deletion is immediate and cannot be undone.</p>
          <div className="flex gap-2">
            <Button href="/api/export" variant="secondary" size="sm">Download my data</Button>
            <DeleteAccountButton action={deleteAccount} />
          </div>
        </Card>
      </FadeIn>
    </Page>
  );
}
