import type { Metadata } from "next";
import { Camera, PenLine, Receipt } from "lucide-react";
import { activePass, endedPass, formatDateRange, formatMoney, localDate, navShortcuts, passLabel, pluralize, tripDayNumber } from "@voya/core";
import { PassGate } from "@/components/split/PassGate";
import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Card, Chip, EmptyState, IconCoin, ListRow, PageHeader, SectionHeader, Tile } from "@/components/ui/primitives";
import { getActiveTrip, getAllBills, getEntitlements, getTripBundle, now } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Split" };

/** Split hub: the pass gate when locked; otherwise start a bill (tonight's dinner prefilled) and the trip's bills. */
export default async function SplitPage() {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  const bundle = active ? await getTripBundle(active.id) : null;
  const at = now();
  const pass = activePass(await getEntitlements(), active?.id ?? null, at);
  if (!active || !bundle) {
    return <Page><PageHeader eyebrow="Split" title="No active trip" /><EmptyState title="Create a trip first" body="Split uses the travelers and currency already on your trip." action={<Button href="/trips/new">Create a trip</Button>} /></Page>;
  }
  if (!pass) {
    const past = (await getAllBills()).filter((b) => b.status === "settled").slice(0, 3);
    return (
      <Page>
        <FadeIn className="flex flex-col gap-3.5">
          <PageHeader eyebrow={`${active.name} · Tools`} title="Split" action={<Chip tone="premium">Atlas</Chip>} />
          {endedPass(await getEntitlements(), active.id, at) && (
            <div role="status" className="card flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">Atlas Premium Pass ended</p><p className="text-[12px] text-muted">Your bills stay readable and shareable.</p></div>
              <Button href="/pass" size="sm">Upgrade</Button>
            </div>
          )}
          <PassGate localCurrency={active.local_currency} homeCurrency={user.profile.home_currency} />
          {past.length > 0 && (
            <>
              <SectionHeader title="Past splits" />
              <Card className="divide-y divide-line">
                {past.map((b) => <ListRow key={b.id} leading={<Tile name={b.merchant} size={40} invert />} title={b.merchant} subtitle={`${b.trip_name} · ${pluralize(b.people, "person", "people")} · settled`} />)}
              </Card>
            </>
          )}
        </FadeIn>
      </Page>
    );
  }
  const tz = active.local_tz ?? user.profile.home_tz;
  const today = localDate(at, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  const dinner = navShortcuts(bundle, day, hhmm).find((s) => s.key === "dinner");
  const bills = bundle.bills;
  const others = (await getAllBills()).filter((b) => b.trip_id !== active.id);
  const totalOf = (id: string) => bundle.billItems.filter((i) => i.bill_id === id).reduce((s, i) => s + i.qty * i.unit_price, 0) + (bundle.bills.find((b) => b.id === id)?.tax_amount ?? 0) + (bundle.bills.find((b) => b.id === id)?.service_amount ?? 0) - (bundle.bills.find((b) => b.id === id)?.discount_amount ?? 0);

  return (
    <Page>
      <FadeIn className="flex flex-col gap-3.5">
        <PageHeader eyebrow={`${active.name} · Tools`} title="Split" action={<Chip tone="premium">{passLabel(pass, at)}</Chip>} />
        <SectionHeader title="New bill" />
        <Card className="divide-y divide-line">
          <ListRow href={dinner ? `/split/new?place=${dinner.place.id}` : "/split/new"} leading={<IconCoin><Camera size={20} /></IconCoin>} title="Scan a receipt" subtitle={dinner ? `${dinner.place.name} · tonight's dinner · ${active.local_currency ?? user.profile.home_currency} · ${pluralize(bundle.travelers.length, "person", "people")} from your trip` : `${active.local_currency ?? user.profile.home_currency} · ${pluralize(bundle.travelers.length, "person", "people")} from your trip`} chevron />
          <ListRow href={`/split/new?manual=1${dinner ? `&place=${dinner.place.id}` : ""}`} leading={<IconCoin><PenLine size={20} /></IconCoin>} title="Enter by hand" subtitle="No receipt, or the scanner missed it" chevron />
        </Card>

        <SectionHeader title={`Bills on ${active.name}`} />
        {bills.length ? (
          <Card className="divide-y divide-line">
            {bills.map((b) => {
              const people = bundle.billParticipants.filter((p) => p.bill_id === b.id).length;
              const claimed = bundle.billParticipants.filter((p) => p.bill_id === b.id && p.claim_status === "claimed").length;
              return (
                <ListRow key={b.id} href={`/split/${b.id}`} leading={<IconCoin><Receipt size={20} /></IconCoin>} title={b.merchant} subtitle={`${formatMoney(totalOf(b.id), b.currency)} · ${pluralize(people, "person", "people")}${claimed ? ` · ${claimed} claimed by link` : ""}${b.bill_date ? ` · ${formatDateRange(b.bill_date, null)}` : ""}`} trailing={<Chip tone={b.status === "settled" ? "plain" : b.status === "open" ? "tint" : "plain"}>{b.status === "settled" ? "Settled" : b.status === "open" ? "Open" : "Draft"}</Chip>} chevron ariaLabel={`${b.merchant}, ${formatMoney(totalOf(b.id), b.currency)}, ${pluralize(people, "person", "people")}, ${b.status}`} />
              );
            })}
          </Card>
        ) : (
          <EmptyState title="No bills yet" body="Scan tonight's receipt and everyone pays their share." />
        )}

        {others.length > 0 && (
          <>
            <SectionHeader title="Past splits" />
            <Card className="divide-y divide-line">
              {others.map((b) => <ListRow key={b.id} leading={<Tile name={b.trip_name} size={40} invert />} title={b.merchant} subtitle={`${b.trip_name} · ${pluralize(b.people, "person", "people")} · ${b.status}`} />)}
            </Card>
          </>
        )}
      </FadeIn>
    </Page>
  );
}
