import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { offlinePacks, readSettings } from "@voya/core";
import { OfflinePacks } from "@/components/settings/OfflinePacks";
import { TripBehaviour } from "@/components/settings/TripBehaviour";
import { Page } from "@/components/shell/Page";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, ListRow, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { updateSettingsAction } from "@/app/(app)/profile/actions";
import { getActiveTrip, getTripBundle } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

/** Settings (mockup 6a): appearance, trip behaviour, offline packs, and the way to permissions & legal. */
export default async function SettingsPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  const packs = bundle ? offlinePacks(bundle) : [];
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href="/profile" variant="secondary" size="sm" aria-label="Back to Profile" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <PageHeader eyebrow="Profile" title="Settings" />
        </div>

        <SectionHeader title="Appearance" id="appearance" />
        <Card className="flex items-center justify-between gap-3 p-3.5">
          <span className="text-[15px] font-semibold">Theme</span>
          <ThemeToggle labels />
        </Card>

        <SectionHeader title="Trip behaviour" id="behaviour" />
        <Card className="divide-y divide-line">
          <TripBehaviour initial={readSettings(user.profile.settings)} action={updateSettingsAction} />
        </Card>

        <SectionHeader title="Offline" id="offline" />
        <Card className="divide-y divide-line">
          {packs.length ? <OfflinePacks packs={packs} /> : <ListRow title="No trip yet" subtitle="Offline packs follow your active trip." />}
        </Card>

        <SectionHeader title="Privacy" />
        <Card className="divide-y divide-line">
          <ListRow href="/settings/permissions" title="Permissions & legal" subtitle="Location, microphone, camera, notifications · Terms, Privacy, your data" chevron />
        </Card>
      </FadeIn>
    </Page>
  );
}
