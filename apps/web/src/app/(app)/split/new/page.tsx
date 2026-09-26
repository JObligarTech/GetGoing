import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { activePass, placeById } from "@voya/core";
import { ScanReceipt } from "@/components/split/ScanReceipt";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Chip, PageHeader } from "@/components/ui/primitives";
import { saveBillAction, scanReceiptAction } from "@/app/(app)/split/actions";
import { getActiveTrip, getEntitlements, getTripBundle, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Scan receipt" };
const qs = z.object({ place: z.uuid().optional(), manual: z.string().optional() });

export default async function NewBillPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = qs.safeParse(await searchParams);
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) redirect("/split");
  if (!activePass(await getEntitlements(), active.id, now())) redirect("/split");
  const place = q.success && q.data.place ? placeById(bundle, q.data.place) : null;
  const currency = active.local_currency ?? user.profile.home_currency;
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href="/split" variant="secondary" size="sm" aria-label="Back to Split" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <PageHeader eyebrow={`Atlas Premium Pass · ${active.name}`} title={q.success && q.data.manual ? "Enter by hand" : "Scan receipt"} action={<Chip tone="premium">Atlas</Chip>} />
        </div>
        <ScanReceipt
          tripId={active.id}
          merchant={place?.name ?? null}
          placeId={place?.id ?? null}
          currency={currency}
          people={bundle.travelers.map((t) => ({ id: t.id, name: t.name.split(" ")[0]!, color: t.color, homeCurrency: t.home_currency ?? (t.user_id === user.id ? user.profile.home_currency : null) }))}
          manual={Boolean(q.success && q.data.manual)}
          scanAction={scanReceiptAction}
          saveAction={saveBillAction}
        />
      </FadeIn>
    </Page>
  );
}
