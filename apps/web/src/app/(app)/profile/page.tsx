import type { Metadata } from "next";
import Link from "next/link";
import { Download, Lock, Settings } from "lucide-react";
import { activePass, markFor, offlinePacks, passSummary, profileStats } from "@voya/core";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Avatar, PassChip, PassStar } from "@/components/ui/PassMark";
import { Card, ListRow, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { ProfileDefaults } from "@/components/profile/ProfileDefaults";
import { signOut } from "@/app/auth/actions";
import { updateDefaultsAction } from "@/app/(app)/profile/actions";
import { getActiveTrip, getEntitlements, getTripBundle, getTrips, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profile" };

/** Profile (mockup 6a): who you are, the pass, three stats, the defaults every tool reuses, and account rows. */
export default async function ProfilePage() {
  const user = await requireUser();
  const p = user.profile;
  const [trips, active, entitlements] = await Promise.all([getTrips(), getActiveTrip(user.profile.home_tz), getEntitlements()]);
  const bundle = active ? await getTripBundle(active.id) : null;
  const at = now();
  const pass = activePass(entitlements, active?.id ?? null, at);
  const summary = passSummary(pass, at, active?.local_tz ?? p.home_tz);
  const stats = profileStats(trips);
  const packs = bundle ? offlinePacks(bundle) : [];
  const firstMap = packs.find((x) => x.kind === "map");
  const handle = `@${(user.email ?? p.display_name).split("@")[0]!.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <PageHeader eyebrow="Trip defaults reused by every tool" title="Profile" action={<Button href="/settings" variant="secondary" size="sm" icon={<Settings size={16} />} aria-label="Settings">Settings</Button>} />
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={p.display_name} size={56} mark={markFor(pass)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-extrabold">{p.display_name}</p>
              <p className="truncate text-[12.5px] text-muted">{user.email} · {handle}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-bold text-premium-text"><PassStar size={11} className="text-premium" />{pass ? summary.title : "Free"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-canvas">
            {[["Trips", stats.trips], ["Saved places", stats.places], ["Countries", stats.countries]].map(([k, v]) => (
              <div key={k} className="flex flex-col items-center py-2.5"><dt className="order-2 text-[11.5px] font-semibold text-muted">{k}</dt><dd className="order-1 text-[20px] font-extrabold tracking-[-0.02em]">{v}</dd></div>
            ))}
          </dl>
        </Card>

        <SectionHeader title="Defaults" />
        <Card className="divide-y divide-line">
          <ProfileDefaults initial={{ homeCurrency: p.home_currency, homeTz: p.home_tz, languages: p.languages, units: p.units }} action={updateDefaultsAction} />
        </Card>

        <SectionHeader title="Account" />
        <Card className="divide-y divide-line">
          <ListRow href="/pass" leading={<span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-premium-bg text-premium-text"><PassStar size={18} /></span>} title="Atlas Premium Pass" subtitle={pass ? summary.detail : "Split, Navigate trees, Translate and Currency on every trip"} trailing={pass ? <PassChip mark={markFor(pass)}>{markFor(pass) === "gifted" ? "Gifted" : undefined}</PassChip> : <span className="text-[13px] font-bold text-primary">Upgrade</span>} chevron />
          <ListRow href="/settings#offline" leading={<span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-tint text-primary"><Download size={18} /></span>} title="Offline downloads" subtitle={firstMap ? `${firstMap.title.replace(" map", "")} · ${firstMap.sizeMb} MB` : "Pick a trip to download"} chevron />
          <ListRow href="/settings/permissions" leading={<span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-tint text-primary"><Lock size={18} /></span>} title="Privacy & data" subtitle="Permissions, legal, download or delete your data" chevron />
        </Card>

        <form action={signOut}>
          <Button type="submit" variant="secondary" full>Sign out</Button>
        </form>
        <p className="text-center text-[11.5px] text-muted">Get Going Labs (placeholder) · <Link href="/legal/terms" className="font-bold text-primary">Legal</Link></p>
      </FadeIn>
    </Page>
  );
}
