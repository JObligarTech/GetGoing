import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { activePass, billBundle, languageByCode } from "@voya/core";
import { BillEditor } from "@/components/split/BillEditor";
import { claimLinkAction, deleteBillAction, saveBillAction } from "@/app/(app)/split/actions";
import { translateAction } from "@/app/(app)/translate/actions";
import { getActiveTrip, getEntitlements, getTripBundle, now } from "@/lib/data";
import { fx } from "@/lib/providers";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Split a bill" };
const qs = z.object({ step: z.enum(["1", "2", "3"]).optional(), manual: z.string().optional() });

/** One bill: items → assign → results. Rates for every home currency on the bill are fetched here. */
export default async function BillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const q = qs.safeParse(await searchParams);
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  if (!active || !bundle) notFound();
  if (!activePass(await getEntitlements(), active.id, now())) redirect("/split");
  const bb = billBundle(bundle, id);
  if (!bb) notFound();
  const homes = new Set([user.profile.home_currency, ...bb.participants.map((p) => p.home_currency).filter((c): c is string => !!c)]);
  const rates: Record<string, number> = {};
  for (const cur of homes) {
    if (cur === bb.bill.currency) continue;
    try { rates[cur] = (await fx.rate(bb.bill.currency, cur)).rate; } catch { /* no rate: shown in the bill currency only */ }
  }
  const startStep = q.success && q.data.step ? (Number(q.data.step) as 1 | 2 | 3) : bb.bill.status === "settled" ? 3 : bb.shares.length ? 2 : 1;
  return (
    <BillEditor
      initial={bb}
      tripName={active.name}
      tripLanguage={languageByCode(active.local_language)?.code ?? "en"}
      userLanguage={languageByCode(user.profile.locale)?.code ?? "en"}
      rates={rates}
      homeCurrency={user.profile.home_currency}
      startStep={startStep}
      saveAction={saveBillAction}
      claimLinkAction={claimLinkAction}
      translateAction={translateAction}
      deleteAction={deleteBillAction}
    />
  );
}
