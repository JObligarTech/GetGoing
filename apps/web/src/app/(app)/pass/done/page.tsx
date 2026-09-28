import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatEnds, kindLabel } from "@voya/core";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Avatar, PassStar } from "@/components/ui/PassMark";
import { Card } from "@/components/ui/primitives";
import { getActiveTrip, getEntitlements } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Congratulations" };

const fmt = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" });

/** Pass active confirmation (mockup 7a, dark): what was bought, how it was paid, and the mark on the avatar. */
export default async function PassDonePage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const user = await requireUser();
  const id = z.uuid().safeParse(e);
  const pass = id.success ? (await getEntitlements()).find((x) => x.id === id.data) : null;
  if (!pass) redirect("/pass");
  const active = await getActiveTrip(user.profile.home_tz);
  const tz = active?.local_tz ?? user.profile.home_tz;
  const first = user.profile.display_name.split(" ")[0];
  const gifted = pass.kind === "gift" || pass.kind === "extension";
  const renews = pass.kind === "monthly" || pass.kind === "yearly";
  const line = renews ? `${kindLabel(pass.kind)} · renews ${fmt(pass.ends_at, tz)}.` : pass.kind === "trip" ? `${kindLabel(pass.kind)} · ${active?.name ?? "your trip"} · ends ${fmt(new Date(new Date(pass.ends_at).getTime() - 60_000).toISOString(), tz)}.` : `${kindLabel(pass.kind)} · ends ${formatEnds(new Date(pass.ends_at), tz)}.`;
  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <div className="flex justify-end"><Button href={pass.kind === "trip" || gifted ? "/split" : "/home"} variant="ghost" size="sm">Done</Button></div>
        <section aria-labelledby="done-title" className="flex flex-col items-center gap-3 rounded-2xl bg-button-ink px-5 py-8 text-center text-on-button-ink">
          <Avatar name={user.profile.display_name} size={72} mark={gifted ? "gifted" : "pass"} label={`${user.profile.display_name}, Atlas Premium Pass`} />
          <p className="text-[13px] font-semibold opacity-80">{gifted ? "Gift accepted" : "Congratulations"}, {first}</p>
          <h1 id="done-title" className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]">You have Atlas Premium Pass</h1>
          <p className="text-[14px] opacity-90">{line}</p>
          <p className="max-w-sm text-[13px] opacity-80">Split, Navigate trees, Translate and Currency are unlocked {pass.trip_id ? `on ${active?.name ?? "this trip"}` : "on every trip"}.</p>
        </section>
        <Card className="divide-y divide-line">
          <div className="flex items-center justify-between px-4 py-3"><span className="flex items-center gap-2 text-[14px] font-semibold"><PassStar size={14} className="text-premium" />Atlas Premium Pass · {kindLabel(pass.kind).toLowerCase()}</span><span className="text-[15px] font-extrabold">{pass.amount != null ? `$${pass.amount.toFixed(2)}` : "Free"}</span></div>
          {pass.paid_with && <div className="flex items-center justify-between px-4 py-3 text-[14px]"><span className="text-muted">Paid with</span><span className="font-semibold">{pass.paid_with}</span></div>}
          <div className="flex items-center justify-between px-4 py-3 text-[14px]"><span className="text-muted">Receipt</span><span className="font-semibold">{pass.amount ? `Sent to ${user.email}` : "Nothing to pay"}</span></div>
        </Card>
        <p className="text-[13px] text-muted">Your avatar now carries the Atlas mark so travelers know who can split{gifted ? "" : ", gift"} and build trees.</p>
        <Button href="/split/new" size="cta" full>Scan tonight&apos;s receipt</Button>
      </FadeIn>
    </Page>
  );
}
