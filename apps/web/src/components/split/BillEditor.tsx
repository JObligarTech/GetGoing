"use client";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, Check, Languages, Link2, Minus, Pencil, Plus, Share2, Trash2, UserPlus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  billShareText, billTotal, computeBill, convert, formatMoney, fractionLabel, initial, splitRestEvenly, toggleShare,
  type BillBundle, type BillInput, type BillItemRow, type BillParticipantRow, type PassMark, type Translation,
} from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/PassMark";
import { cx } from "@/lib/utils";

export interface BillEditorProps {
  initial: BillBundle;
  tripName: string;
  tripLanguage: string;
  userLanguage: string;
  /** bill currency → home currency rate, for every home currency on the bill */
  rates: Record<string, number>;
  homeCurrency: string;
  /** Participant id → pass mark, so the results avatars carry it (mockup 8a). */
  participantMarks?: Record<string, PassMark>;
  startStep: 1 | 2 | 3;
  saveAction: (input: unknown) => Promise<{ billId: string } | { error: string }>;
  claimLinkAction: (tripId: unknown, billId: unknown, participantId: unknown) => Promise<{ url: string } | { error: string }>;
  translateAction: (input: unknown) => Promise<Translation | { error: string }>;
  deleteAction: (tripId: unknown, billId: unknown) => Promise<{ ok: true } | { error: string }>;
}
type Step = 1 | 2 | 3;
const STEP_TITLE: Record<Step, string> = { 1: "Check items", 2: "Who had what", 3: "Everyone's share" };

/**
 * Split editor: 1 Check items (OCR correction, add by hand), 2 Who had what (avatars on each
 * item, claim links), 3 Everyone's share (per person, home currency, close). Desktop shows the
 * receipt lines on the left and the steps on the right (mockup 5c).
 */
export function BillEditor({ initial: init, tripName, tripLanguage, userLanguage, rates, homeCurrency, participantMarks = {}, startStep, saveAction, claimLinkAction, translateAction, deleteAction }: BillEditorProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [bill, setBill] = useState(init.bill);
  const [items, setItems] = useState(init.items);
  const [people, setPeople] = useState(init.participants);
  const [shares, setShares] = useState(init.shares);
  const [step, setStep] = useState<Step>(startStep);
  const [selected, setSelected] = useState<string | null>(init.bill.paid_by ?? init.participants[0]?.id ?? null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const comp = useMemo(() => computeBill(bill, items, people, shares), [bill, items, people, shares]);
  const money = (n: number, cur = bill.currency) => formatMoney(n, cur);
  const home = (n: number, cur: string | null) => (cur && cur !== bill.currency && rates[cur] ? formatMoney(convert(n, rates[cur]!, cur), cur) : null);
  const total = billTotal(bill, items);
  const flagged = items.filter((i) => i.confidence != null && i.confidence < 0.7);
  const settled = bill.status === "settled";

  const toInput = (over: Partial<BillInput> = {}): BillInput => ({
    billId: bill.id, tripId: bill.trip_id, placeId: bill.place_id, merchant: bill.merchant, currency: bill.currency, status: bill.status, billDate: bill.bill_date,
    taxAmount: bill.tax_amount, taxLabel: bill.tax_label, serviceAmount: bill.service_amount, discountAmount: bill.discount_amount, roundingUnit: bill.rounding_unit, taxMode: bill.tax_mode, paidBy: bill.paid_by,
    items: items.map((i) => ({ id: i.id, name: i.name, localName: i.local_name, qty: i.qty, unitPrice: i.unit_price, confidence: i.confidence })),
    participants: people.map((p) => ({ id: p.id, travelerId: p.traveler_id, name: p.name, color: p.color, homeCurrency: p.home_currency })),
    shares: shares.map((s) => ({ itemId: s.item_id, participantId: s.participant_id })),
    ...over,
  });
  const save = (over: Partial<BillInput>, then?: () => void, message?: string) => start(async () => {
    const r = await saveAction(toInput(over));
    if ("error" in r) { setError(r.error); return; }
    setError(null);
    if (over.status) setBill((b) => ({ ...b, status: over.status! }));
    if (message) setStatus(message);
    then?.();
    router.refresh();
  });

  // Step 1 edits
  const updateItem = (id: string, patch: Partial<BillItemRow>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => { setItems((list) => list.filter((i) => i.id !== id)); setShares((s) => s.filter((x) => x.item_id !== id)); };
  const addItem = (name: string, price: number, qty: number, who: string[]) => {
    const id = crypto.randomUUID();
    const row: BillItemRow = { id, bill_id: bill.id, trip_id: bill.trip_id, name, local_name: null, qty, unit_price: price, confidence: null, sort_order: items.length, created_at: new Date().toISOString() };
    setItems((list) => [...list, row]);
    setShares((s) => [...s, ...who.map((participant_id) => ({ item_id: id, participant_id, bill_id: bill.id, trip_id: bill.trip_id }))]);
    setStatus(`Added ${name} · ${money(price * qty)}${who.length ? ` · ${who.map((w) => people.find((p) => p.id === w)?.name).join(" & ")}` : ""}.`);
  };
  const translateNames = () => start(async () => {
    const out = await Promise.all(items.map(async (i) => {
      if (!i.local_name) return i;
      const r = await translateAction({ text: i.local_name, from: tripLanguage, to: userLanguage });
      return "error" in r || r.approximate ? i : { ...i, name: r.text };
    }));
    setItems(out); setStatus("Item names translated.");
  });

  // Step 2 edits
  const addGuest = (name: string) => {
    const id = crypto.randomUUID();
    const colors = ["#2B8C8C", "#8C5AA6", "#B5651D", "#E0A020"];
    setPeople((list) => [...list, { id, bill_id: bill.id, trip_id: bill.trip_id, traveler_id: null, name, color: colors[list.length % colors.length]!, home_currency: null, claim_token: null, claim_status: "none", claim_expires_at: "", created_at: new Date().toISOString() }]);
    setSelected(id); setStatus(`${name} added to this bill only.`);
  };
  const sendLink = (p: BillParticipantRow) => start(async () => {
    // The bill has to exist server-side with this person before a link can be issued.
    const saved = await saveAction(toInput({ status: bill.status === "draft" ? "open" : bill.status }));
    if ("error" in saved) { setError(saved.error); return; }
    if (bill.status === "draft") setBill((b) => ({ ...b, status: "open" }));
    const r = await claimLinkAction(bill.trip_id, bill.id, p.id);
    if ("error" in r) { setError(r.error); return; }
    setPeople((list) => list.map((x) => (x.id === p.id && x.claim_status === "none" ? { ...x, claim_status: "sent" } : x)));
    const text = `${p.name}, pick what you ordered at ${bill.merchant}: ${r.url}`;
    try {
      if (navigator.share) { await navigator.share({ text }); setStatus(`Link sent to ${p.name}.`); }
      else { await navigator.clipboard.writeText(r.url); setStatus(`Claim link for ${p.name} copied: ${r.url}`); }
    } catch { setStatus(`Claim link for ${p.name}: ${r.url}`); }
  });

  const stepper = (
    <ol className="flex items-center gap-1 text-[12.5px] font-bold" aria-label="Steps">
      {([1, 2, 3] as Step[]).map((n) => (
        <li key={n} className="flex items-center gap-1">
          <button type="button" onClick={() => setStep(n)} aria-current={step === n ? "step" : undefined} className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5", step === n ? "bg-primary text-on-primary" : n < step ? "text-primary" : "text-muted hover:bg-tint")}>
            <span aria-hidden="true" className={cx("inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]", step === n ? "bg-white/20" : "bg-tint text-on-tint")}>{n < step ? <Check size={12} /> : n}</span>
            {n === 1 ? "Items" : n === 2 ? "Assign" : "Results"}
          </button>
          {n < 3 && <span aria-hidden="true" className="h-px w-3 bg-line-strong" />}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3.5 px-4 pt-4 pb-6 md:px-7 md:pt-7 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-x-8">
      <aside aria-label="Receipt" className="hidden lg:sticky lg:top-7 lg:flex lg:flex-col lg:gap-3">
        <ReceiptPane bill={bill} items={items} pages={bill.receipt_pages} onRescan={() => router.push(`/split/new?place=${bill.place_id ?? ""}` as Route)} onTranslate={translateNames} tripName={tripName} />
      </aside>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Button href="/split" variant="secondary" size="sm" aria-label="Back to Split" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-muted">Step {step} of 3 · {STEP_TITLE[step]}</p>
            <h1 className="truncate text-[26px] font-extrabold tracking-[-0.02em]">{bill.merchant}</h1>
          </div>
          <Chip tone={settled ? "plain" : "premium"}>{settled ? "Settled" : "Atlas"}</Chip>
        </div>
        {stepper}
        {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</p>}
        <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>

        {step === 1 && (
          <section aria-labelledby="items-title" className="flex flex-col gap-3">
            <h2 id="items-title" className="sr-only">Check items</h2>
            {flagged.length > 0 && <p className="rounded-lg bg-premium-bg px-3.5 py-2.5 text-[13px] font-semibold text-premium-text">{flagged.length === 1 ? "1 line looks uncertain." : `${flagged.length} lines look uncertain.`} Tap a value to fix it.</p>}
            <ul className="flex flex-col gap-2" aria-label="Items">
              {items.map((i) => (
                <li key={i.id} className={cx("card flex flex-col gap-2 p-3", i.confidence != null && i.confidence < 0.7 && "border-premium")}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {i.local_name && <p className="truncate text-[12px] text-muted" lang={tripLanguage}>{i.local_name}{i.confidence != null && i.confidence < 0.7 ? ` · low confidence · read as "${i.local_name}"` : ""}</p>}
                      <label className="sr-only" htmlFor={`name-${i.id}`}>Item name</label>
                      <input id={`name-${i.id}`} value={i.name} disabled={settled} onChange={(e) => updateItem(i.id, { name: e.target.value.slice(0, 120) })} className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-bold outline-none hover:border-line-strong focus:border-primary" />
                    </div>
                    <button type="button" onClick={() => removeItem(i.id)} disabled={settled || items.length === 1} aria-label={`Remove ${i.name}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-tint hover:text-danger disabled:opacity-40"><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div role="group" aria-label={`Quantity of ${i.name}`} className="inline-flex items-center rounded-full border border-line-strong">
                      <button type="button" disabled={settled || i.qty <= 1} onClick={() => updateItem(i.id, { qty: i.qty - 1 })} aria-label="Fewer" className="inline-flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"><Minus size={14} aria-hidden="true" /></button>
                      <span className="min-w-8 text-center text-[13px] font-bold" aria-live="polite">×{i.qty}</span>
                      <button type="button" disabled={settled || i.qty >= 99} onClick={() => updateItem(i.id, { qty: i.qty + 1 })} aria-label="More" className="inline-flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"><Plus size={14} aria-hidden="true" /></button>
                    </div>
                    <label className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                      <span>{i.qty > 1 ? "each" : "price"}</span>
                      <input inputMode="decimal" value={String(i.unit_price)} disabled={settled} aria-label={`Unit price of ${i.name} in ${bill.currency}`} onChange={(e) => updateItem(i.id, { unit_price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="w-24 rounded-md border border-line-strong bg-surface px-2 py-1 text-right text-[14px] font-bold text-ink outline-none focus:border-primary" />
                    </label>
                    <span className="text-[15px] font-extrabold">{money(i.qty * i.unit_price)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {!settled && <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)} aria-haspopup="dialog">Add missing line</Button>}
            <Card className="divide-y divide-line">
              <Row label="Subtotal" value={money(comp.subtotal)} />
              <EditableRow label={bill.tax_label ?? "Tax"} value={bill.tax_amount} currency={bill.currency} disabled={settled} onChange={(v) => setBill((b) => ({ ...b, tax_amount: v }))} onLabel={(l) => setBill((b) => ({ ...b, tax_label: l || null }))} />
              <EditableRow label="Service / tip" value={bill.service_amount} currency={bill.currency} disabled={settled} onChange={(v) => setBill((b) => ({ ...b, service_amount: v }))} hint={bill.service_amount === 0 ? "None" : undefined} />
              {bill.discount_amount > 0 && <EditableRow label="Discount" value={bill.discount_amount} currency={bill.currency} disabled={settled} onChange={(v) => setBill((b) => ({ ...b, discount_amount: v }))} negative />}
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="text-[15px] font-extrabold">Total</span>
                <span className="text-right"><span className="block text-[18px] font-extrabold">{money(total)}</span>{home(total, homeCurrency) && <span className="text-[12px] text-muted">≈ {home(total, homeCurrency)}</span>}</span>
              </div>
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Languages size={16} />} onClick={translateNames} loading={pending} disabled={!items.some((i) => i.local_name)}>Translate</Button>
              <Button className="flex-1" size="cta" onClick={() => save({ status: settled ? "settled" : "open" }, () => setStep(2), "Items saved.")} loading={pending}>Looks right · Add people</Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="assign-title" className="flex flex-col gap-3">
            <h2 id="assign-title" className="sr-only">Who had what</h2>
            <div role="radiogroup" aria-label="People" className="flex flex-wrap items-center gap-2">
              {people.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={selected === p.id} onClick={() => setSelected(p.id)} className={cx("inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1 text-[13px] font-bold transition-colors", selected === p.id ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface hover:bg-tint")}>
                  <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] text-white" style={{ background: p.color }}>{initial(p.name)}</span>{p.name}
                  {p.claim_status === "claimed" && <Chip className="h-5 px-1.5 text-[10px]">Claimed</Chip>}
                </button>
              ))}
              {!settled && <Button variant="secondary" size="sm" icon={<UserPlus size={16} />} onClick={() => setGuestOpen(true)} aria-haspopup="dialog">Guest</Button>}
              {!settled && selected && <Button variant="secondary" size="sm" icon={<Link2 size={16} />} onClick={() => { const p = people.find((x) => x.id === selected); if (p) sendLink(p); }} loading={pending}>Send link</Button>}
            </div>
            <p className="text-[12.5px] text-muted">Tap avatars on each item. {people.find((p) => p.id === selected)?.name ?? "Someone"} is selected — tap items to claim them.</p>
            <ul className="flex flex-col gap-2" aria-label="Items to assign">
              {items.map((i) => {
                const who = people.filter((p) => shares.some((s) => s.item_id === i.id && s.participant_id === p.id));
                const each = who.length ? (i.qty * i.unit_price) / who.length : null;
                return (
                  <li key={i.id} className="card flex items-center gap-3 p-3">
                    <button type="button" disabled={settled || !selected} onClick={() => selected && setShares((s) => toggleShare(s, bill, i.id, selected))} className="min-w-0 flex-1 text-left" aria-label={`${i.name}: ${who.length ? `shared by ${who.map((w) => w.name).join(", ")}` : "unassigned"}. ${selected ? `Toggle for ${people.find((p) => p.id === selected)?.name}` : ""}`}>
                      <span className="block truncate text-[15px] font-bold">{i.name}</span>
                      <span className="block text-[12px] text-muted">{who.length > 1 ? `Shared by ${who.length} · ${money(each!)} each` : who.length === 1 ? `${i.qty > 1 ? `×${i.qty} · ${money(i.unit_price)} each` : "Just " + who[0]!.name}` : "Unassigned"}</span>
                    </button>
                    <div role="group" aria-label={`Who had ${i.name}`} className="flex items-center gap-1">
                      {people.map((p) => {
                        const on = who.some((w) => w.id === p.id);
                        return <button key={p.id} type="button" role="checkbox" aria-checked={on} aria-label={p.name} disabled={settled} onClick={() => setShares((s) => toggleShare(s, bill, i.id, p.id))} className={cx("inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-transform", on ? "scale-100 border-transparent text-white" : "scale-90 border-line-strong bg-surface text-muted")} style={on ? { background: p.color } : undefined}>{initial(p.name)}</button>;
                      })}
                    </div>
                    <span className="w-16 text-right text-[14px] font-extrabold">{money(i.qty * i.unit_price)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" disabled={settled || comp.unassigned === 0} onClick={() => setShares((s) => splitRestEvenly(bill, items, people, s))}>Split rest evenly</Button>
              <button type="button" role="switch" aria-checked={bill.tax_mode === "even"} disabled={settled} onClick={() => setBill((b) => ({ ...b, tax_mode: b.tax_mode === "even" ? "proportional" : "even" }))} className={cx("inline-flex h-10 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-bold", bill.tax_mode === "even" ? "text-primary" : "text-muted")}>
                <span aria-hidden="true" className={cx("inline-block h-4 w-7 rounded-full p-0.5 transition-colors", bill.tax_mode === "even" ? "bg-primary" : "bg-line-strong")}><span className={cx("block h-3 w-3 rounded-full bg-white transition-transform", bill.tax_mode === "even" && "translate-x-3")} /></span>
                Everyone shares tax {bill.tax_mode === "even" ? "evenly" : "in proportion"}
              </button>
            </div>
            <Card className="flex items-center justify-between p-3.5">
              <div><p className="text-[12px] font-bold uppercase tracking-wide text-muted">Assigned</p><p className="text-[17px] font-extrabold" aria-live="polite">{money(comp.assigned)} · {money(comp.unassigned)} left</p></div>
              <Button size="cta" onClick={() => save({ status: settled ? "settled" : "open" }, () => setStep(3), "Shares saved.")} loading={pending}>Calculate</Button>
            </Card>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="results-title" className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="results-title" className="text-[20px] font-extrabold">Everyone&apos;s share</h2><p className="text-[12.5px] text-muted">{bill.tax_label ?? "Tax"} {bill.tax_mode === "even" ? "shared evenly" : "shared in proportion"} · rounded to {money(bill.rounding_unit)}</p></div>
              <Button variant="secondary" size="sm" icon={<Share2 size={16} />} onClick={async () => { const text = billShareText(bill, comp, rates[homeCurrency] ? { home: { currency: homeCurrency, rate: rates[homeCurrency]! } } : {}); try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setStatus("Summary copied to clipboard."); } } catch { /* cancelled */ } }}>Share</Button>
            </div>
            <Card className="flex items-center justify-between p-3.5">
              <div><p className="text-[12px] font-bold uppercase tracking-wide text-muted">Bill total</p><p className="text-[24px] font-extrabold">{money(comp.total)}</p></div>
              {home(comp.total, homeCurrency) && <p className="text-[14px] font-semibold text-muted">≈ {home(comp.total, homeCurrency)}</p>}
            </Card>
            {comp.unassigned > 0 && <p role="note" className="rounded-lg bg-premium-bg px-3.5 py-2.5 text-[13px] font-semibold text-premium-text">{money(comp.unassigned)} is still unassigned ({comp.unassignedItems.map((i) => i.name).join(", ")}). It isn&apos;t in anyone&apos;s share yet.</p>}
            <ul className="flex flex-col gap-2" aria-label="Shares">
              {comp.participants.map((pt, idx) => {
                const p = pt.participant;
                const isPayer = p.id === comp.payerId;
                const h = home(pt.total, p.home_currency) ?? (p.home_currency !== homeCurrency ? home(pt.total, homeCurrency) : null);
                const extra = p.home_currency && p.home_currency !== homeCurrency && p.home_currency !== bill.currency ? home(pt.total, homeCurrency) : null;
                return (
                  <motion.li key={p.id} initial={reduce ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.2, delay: reduce ? 0 : idx * 0.04 }} className="card flex flex-col gap-2 p-3.5" aria-label={`${p.name}: ${money(pt.total)}${h ? `, about ${h}` : ""}${isPayer ? ", paid" : ""}`}>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} color={p.color} size={36} mark={participantMarks[p.id] ?? null} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[15px] font-bold">{p.name}{isPayer && <span className="text-[12px] font-semibold text-muted">· you paid</span>}{p.claim_status === "claimed" && <Chip className="h-5 px-1.5 text-[10px]">Claimed</Chip>}{p.claim_status === "opened" && <Chip tone="plain" className="h-5 px-1.5 text-[10px]">Link opened</Chip>}</p>
                        <p className="truncate text-[12px] text-muted">{isPayer && pt.collects > 0 ? `Collects ${money(pt.collects)} from ${comp.participants.length - 1} people` : pt.lines.map((l) => `${fractionLabel(l.fraction)}${fractionLabel(l.fraction) ? " " : ""}${l.label}`).concat(pt.tax ? ["tax"] : []).join(" · ")}</p>
                      </div>
                      <div className="text-right"><p className="text-[17px] font-extrabold">{money(pt.total)}</p>{h && <p className="text-[12px] text-muted">{h}{extra ? ` · ${extra}` : ""}</p>}</div>
                    </div>
                    {isPayer && (
                      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-line pt-2 text-[12.5px]">
                        {pt.lines.map((l) => <div key={l.itemId} className="contents"><dt className="text-muted">{fractionLabel(l.fraction)} {l.label}</dt><dd className="text-right font-semibold">{money(l.amount)}</dd></div>)}
                        {pt.tax > 0 && <div className="contents"><dt className="text-muted">Tax</dt><dd className="text-right font-semibold">{money(pt.tax)}</dd></div>}
                        {pt.service > 0 && <div className="contents"><dt className="text-muted">Service</dt><dd className="text-right font-semibold">{money(pt.service)}</dd></div>}
                      </dl>
                    )}
                  </motion.li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={settled} onClick={() => setBill((b) => ({ ...b, rounding_unit: nextRounding(b.rounding_unit, b.currency) }))}>Adjust rounding · {money(bill.rounding_unit)}</Button>
              <Button variant="secondary" size="sm" disabled={settled} onClick={() => setDiscountOpen(true)} aria-haspopup="dialog">{bill.discount_amount ? `Discount ${money(bill.discount_amount)}` : "Add discount"}</Button>
              <Button variant="secondary" size="sm" icon={<Pencil size={16} />} onClick={() => setStep(1)}>Edit items</Button>
            </div>
            {settled ? (
              <Button variant="secondary" size="cta" full onClick={() => save({ status: "open" }, undefined, "Bill reopened.")} loading={pending}>Reopen bill</Button>
            ) : (
              <Button size="cta" full onClick={() => save({ status: "settled" }, undefined, "Bill closed. Everyone's share is final.")} loading={pending}>Close bill</Button>
            )}
            <Button variant="danger" size="sm" onClick={() => start(async () => { const r = await deleteAction(bill.trip_id, bill.id); if ("error" in r) setError(r.error); else router.push("/split" as Route); })}>Delete bill</Button>
          </section>
        )}
      </div>

      <AddItemDialog open={addOpen} onClose={() => setAddOpen(false)} people={people} currency={bill.currency} onAdd={addItem} />
      <PromptDialog open={guestOpen} onClose={() => setGuestOpen(false)} title="Add a guest" label="Name" placeholder="Nuno" onSubmit={(v) => addGuest(v)} />
      <PromptDialog open={discountOpen} onClose={() => setDiscountOpen(false)} title="Discount" label={`Amount off, in ${bill.currency}`} placeholder="500" numeric onSubmit={(v) => setBill((b) => ({ ...b, discount_amount: Number(v) || 0 }))} />
    </div>
  );
}

function nextRounding(unit: number, currency: string): number {
  const opts = currency === "JPY" || currency === "KRW" ? [1, 10, 100] : [0.01, 0.05, 0.1, 1];
  const i = opts.indexOf(unit);
  return opts[(i + 1) % opts.length]!;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between px-3.5 py-2.5 text-[14px]"><span className="font-semibold text-muted">{label}</span><span className="font-bold">{value}</span></div>;
}

function EditableRow({ label, value, currency, disabled, onChange, onLabel, hint, negative }: { label: string; value: number; currency: string; disabled: boolean; onChange: (v: number) => void; onLabel?: (l: string) => void; hint?: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2 text-[14px]">
      {onLabel ? <input value={label} aria-label="Tax label" disabled={disabled} onChange={(e) => onLabel(e.target.value.slice(0, 40))} className="w-28 rounded-md border border-transparent bg-transparent px-1 font-semibold text-muted outline-none hover:border-line-strong focus:border-primary" /> : <span className="font-semibold text-muted">{label}</span>}
      <span className="flex items-center gap-2">
        {hint && <span className="text-[12px] text-muted">{hint}</span>}
        {negative && <span aria-hidden="true">−</span>}
        <input inputMode="decimal" value={String(value)} aria-label={`${label} amount in ${currency}`} disabled={disabled} onChange={(e) => onChange(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} className="w-24 rounded-md border border-line-strong bg-surface px-2 py-1 text-right font-bold text-ink outline-none focus:border-primary" />
      </span>
    </div>
  );
}

function ReceiptPane({ bill, items, pages, onRescan, onTranslate, tripName }: { bill: BillBundle["bill"]; items: BillItemRow[]; pages: number; onRescan: () => void; onTranslate: () => void; tripName: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[12.5px] font-bold text-muted"><span>{pages ? `Page 1 of ${pages}` : "Entered by hand"}</span><span>{tripName}</span></div>
      <div className="rounded-xl border border-line bg-[#FBF8F1] p-5 font-mono text-[12.5px] text-[#2A2622] shadow-card" aria-label="Receipt lines as read" role="img">
        <p className="mb-3 text-center text-[14px] font-bold">{bill.merchant}</p>
        {bill.bill_date && <p className="mb-2 text-center text-[11px] text-[#7A7060]">{bill.bill_date}</p>}
        <div className="border-t border-dashed border-[#B8AE96] pt-2">
          {items.map((i) => <div key={i.id} className={cx("flex justify-between gap-2 py-0.5", i.confidence != null && i.confidence < 0.7 && "bg-premium-bg")}><span className="truncate">{i.local_name ?? i.name} {i.qty > 1 ? `×${i.qty}` : ""}</span><span>{formatMoney(i.qty * i.unit_price, bill.currency)}</span></div>)}
        </div>
        <div className="mt-2 border-t border-dashed border-[#B8AE96] pt-2">
          <div className="flex justify-between"><span>{bill.tax_label ?? "Tax"}</span><span>{formatMoney(bill.tax_amount, bill.currency)}</span></div>
          {bill.service_amount > 0 && <div className="flex justify-between"><span>Service</span><span>{formatMoney(bill.service_amount, bill.currency)}</span></div>}
          <div className="mt-1 flex justify-between font-bold"><span>Total</span><span>{formatMoney(billTotal(bill, items), bill.currency)}</span></div>
        </div>
      </div>
      <p className="text-[11.5px] text-muted">Read on the server, never stored. The lines above are the reading, not the photo.</p>
      <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={onRescan}>Re-scan</Button><Button variant="secondary" size="sm" icon={<Languages size={16} />} onClick={onTranslate}>Translate</Button></div>
    </div>
  );
}

/** Manual item (mockup 8b): name, price, quantity and who had it. */
function AddItemDialog({ open, onClose, people, currency, onAdd }: { open: boolean; onClose: () => void; people: BillParticipantRow[]; currency: string; onAdd: (name: string, price: number, qty: number, who: string[]) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [qty, setQty] = useState(1);
  const [who, setWho] = useState<string[]>([]);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) { d.showModal(); d.querySelector<HTMLElement>("input")?.focus(); } if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={id} className="m-auto w-[min(92vw,440px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
      <form action={(fd) => { const name = String(fd.get("name") ?? "").trim(); const price = Number(String(fd.get("price") ?? "").replace(/[^\d.]/g, "")); if (!name || !Number.isFinite(price)) return; onAdd(name, price, qty, who); setQty(1); setWho([]); onClose(); }} className="flex flex-col gap-3 p-4">
        <h2 id={id} className="text-[18px] font-extrabold">Add item by hand</h2>
        <p className="text-[12.5px] text-muted">No receipt, or the scanner missed a line.</p>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Item<input name="name" required maxLength={120} placeholder="Edamame" className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none placeholder:text-faint focus:border-primary" /></label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Price ({currency})<input name="price" inputMode="decimal" required placeholder="450" className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none placeholder:text-faint focus:border-primary" /></label>
        <div role="group" aria-label="Quantity" className="flex items-center gap-2 text-[13px] font-semibold">Quantity
          <span className="inline-flex items-center rounded-full border border-line-strong">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Fewer" className="inline-flex h-9 w-9 items-center justify-center"><Minus size={14} aria-hidden="true" /></button>
            <span className="min-w-8 text-center" aria-live="polite">×{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="More" className="inline-flex h-9 w-9 items-center justify-center"><Plus size={14} aria-hidden="true" /></button>
          </span>
        </div>
        <div role="group" aria-label="Who had it" className="flex flex-col gap-1.5 text-[13px] font-semibold">Who had it
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => { const on = who.includes(p.id); return <button key={p.id} type="button" role="checkbox" aria-checked={on} aria-label={p.name} onClick={() => setWho((w) => (on ? w.filter((x) => x !== p.id) : [...w, p.id]))} className={cx("inline-flex h-9 items-center gap-1.5 rounded-full border pr-3 pl-1 text-[12.5px] font-bold", on ? "border-transparent text-white" : "border-line-strong bg-surface text-ink")} style={on ? { background: p.color } : undefined}><span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-[11px]">{initial(p.name)}</span>{p.name}</button>; })}
          </div>
        </div>
        <div className="flex gap-2"><Button type="button" variant="secondary" full onClick={onClose}>Cancel</Button><Button type="submit" full>Add{who.length ? ` · ${who.map((w) => people.find((p) => p.id === w)?.name).join(" & ")}` : ""}</Button></div>
      </form>
    </dialog>
  );
}

function PromptDialog({ open, onClose, title, label, placeholder, numeric, onSubmit }: { open: boolean; onClose: () => void; title: string; label: string; placeholder?: string; numeric?: boolean; onSubmit: (v: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) { d.showModal(); d.querySelector<HTMLElement>("input")?.focus(); } if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={id} className="m-auto w-[min(92vw,400px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
      <form action={(fd) => { const v = String(fd.get("value") ?? "").trim(); if (!v) return; onSubmit(v); onClose(); }} className="flex flex-col gap-3 p-4">
        <h2 id={id} className="text-[18px] font-extrabold">{title}</h2>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">{label}<input name="value" required maxLength={80} inputMode={numeric ? "decimal" : undefined} placeholder={placeholder} className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none placeholder:text-faint focus:border-primary" /></label>
        <div className="flex gap-2"><Button type="button" variant="secondary" full onClick={onClose}>Cancel</Button><Button type="submit" full>Save</Button></div>
      </form>
    </dialog>
  );
}
