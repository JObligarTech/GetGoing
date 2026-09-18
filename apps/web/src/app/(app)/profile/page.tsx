import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/shell/Page";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Card, Chip, ListRow, PageHeader, SectionHeader, Tile } from "@/components/ui/primitives";
import { deleteAccount, signOut } from "@/app/auth/actions";
import { requireUser } from "@/lib/session";
import { DeleteAccountButton } from "@/components/profile/DeleteAccountButton";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await requireUser();
  const p = user.profile;
  return (
    <Page>
      <PageHeader eyebrow="Trip defaults reused by every tool" title="Profile" />
      {error === "delete" && <p role="alert" className="text-[13px] font-semibold text-danger">Couldn&apos;t delete the account. Try again.</p>}
      <Card className="flex items-center gap-3 p-3.5">
        <Tile name={p.display_name} size={52} radius={999} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold">{p.display_name}</p>
          <p className="truncate text-[12.5px] text-muted">{user.email}</p>
        </div>
        <Chip tone="plain">Free</Chip>
      </Card>

      <SectionHeader title="Defaults" />
      <Card className="divide-y divide-line">
        <ListRow title="Home currency" trailing={<span className="text-[13px] font-bold text-muted">{p.home_currency}</span>} />
        <ListRow title="Home time zone" trailing={<span className="text-[13px] font-bold text-muted">{p.home_tz}</span>} />
      </Card>

      <SectionHeader title="Appearance" />
      <Card className="flex items-center justify-between p-3.5">
        <span className="text-[15px] font-semibold">Theme</span>
        <ThemeToggle />
      </Card>

      <SectionHeader title="Privacy & legal" />
      <Card className="divide-y divide-line">
        <ListRow href="/legal/terms" title="Terms of Service" chevron />
        <ListRow href="/legal/privacy" title="Privacy Policy" chevron />
        <ListRow href="/legal/refunds" title="Refund Policy" chevron />
        <ListRow href="/legal/cookies" title="Cookie Policy" chevron />
        <ListRow href="/legal/licences" title="Licences & credits" chevron />
        <div className="flex flex-col gap-2 px-3.5 py-3">
          <p className="text-[15px] font-semibold">Download or delete my data</p>
          <p className="text-[12px] text-muted">Export is a JSON file of everything in your account. Deletion is immediate and cannot be undone.</p>
          <div className="flex gap-2">
            <Button href="/api/export" variant="secondary" size="sm">Download my data</Button>
            <DeleteAccountButton action={deleteAccount} />
          </div>
        </div>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="secondary" full>Sign out</Button>
      </form>
      <p className="text-center text-[11.5px] text-muted">
        Voya Labs (placeholder) · <Link href="/legal/terms" className="font-bold text-primary">Legal</Link>
      </p>
    </Page>
  );
}
