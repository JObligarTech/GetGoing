/**
 * Split — receipt parsing, bill maths (shared items, tax, service, discounts, rounding),
 * claim-link views and the Atlas Premium Pass check. Pure functions; no I/O.
 */
import type { BillItemRow, BillParticipantRow, BillRow, BillShareRow } from "./db/database.types";
import { formatMoney } from "./format";
import { roundMoney } from "./money";
import type { OcrLine } from "./providers/types";
import { splitPrice } from "./translate";

export type TaxMode = "proportional" | "even";

// ─── Receipt parsing ─────────────────────────────────────────────────────────
export interface ParsedItem { localName: string; qty: number; unitPrice: number; confidence: number }
export interface ParsedReceipt {
  merchant: string | null;
  items: ParsedItem[];
  subtotal: number | null;
  tax: number | null;
  taxLabel: string | null;
  service: number | null;
  total: number | null;
  /** Lines the reader wasn't sure about (confidence < 0.7). */
  flagged: number;
}

const SUBTOTAL_RE = /^(小計|subtotal|sub total|净额)/i;
const TAX_RE = /^(消費税|税|tax|vat|gst|iva|tva|mwst)/i;
const SERVICE_RE = /^(サービス料|service|tip|gratuity|service charge)/i;
const TOTAL_RE = /^(合計|お会計|total|grand total|amount due|balance)/i;
const DATE_RE = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}/;
const QTY_RE = /(?:^|\s)(?:[×xX]\s?(\d{1,2})|(\d{1,2})\s?[×xX]|(\d{1,2})\s?(?:個|pcs?|ea))(?:\s|$)/;

/** Split "柚子塩らーめん ×2 ¥2,400" into label, quantity and line price; qty defaults to 1. */
export function parseReceiptLine(text: string): { label: string; qty: number; price: number | null } {
  const { label: withQty, price } = splitPrice(text);
  const m = QTY_RE.exec(withQty);
  const qty = m ? Number(m[1] ?? m[2] ?? m[3]) : 1;
  const label = m ? withQty.replace(m[0], " ").replace(/\s+/g, " ").trim() : withQty;
  return { label, qty: Math.max(1, Math.min(99, qty || 1)), price };
}

/** Turn OCR lines into items plus subtotal / tax / service / total. Nothing is invented: missing parts stay null. */
export function parseReceipt(lines: OcrLine[]): ParsedReceipt {
  const out: ParsedReceipt = { merchant: null, items: [], subtotal: null, tax: null, taxLabel: null, service: null, total: null, flagged: 0 };
  for (const l of lines) {
    const raw = l.text.trim();
    if (!raw || DATE_RE.test(raw)) continue;
    const { label, qty, price } = parseReceiptLine(raw);
    if (price == null) { if (!out.merchant && out.items.length === 0) out.merchant = label; continue; }
    if (SUBTOTAL_RE.test(label)) { out.subtotal = price; continue; }
    if (TAX_RE.test(label)) { out.tax = price; out.taxLabel = label; continue; }
    if (SERVICE_RE.test(label)) { out.service = price; continue; }
    if (TOTAL_RE.test(label)) { out.total = price; continue; }
    if (!label) continue;
    const unit = qty > 1 ? price / qty : price;
    if (l.confidence < 0.7) out.flagged += 1;
    out.items.push({ localName: label, qty, unitPrice: Math.round(unit * 100) / 100, confidence: l.confidence });
  }
  return out;
}

// ─── Bill maths ──────────────────────────────────────────────────────────────
export interface ShareLine { itemId: string; label: string; qty: number; fraction: number; amount: number }
export interface ParticipantTotal {
  participant: BillParticipantRow;
  lines: ShareLine[];
  itemsTotal: number;
  tax: number;
  service: number;
  discount: number;
  /** Rounding adjustment applied to reach `total` (payer absorbs the remainder). */
  rounding: number;
  total: number;
  /** For the payer: what everyone else owes them. */
  collects: number;
}
export interface BillComputation {
  subtotal: number;
  assigned: number;
  unassigned: number;
  unassignedItems: BillItemRow[];
  total: number;
  participants: ParticipantTotal[];
  payerId: string | null;
}

const lineTotal = (i: Pick<BillItemRow, "qty" | "unit_price">) => Number(i.qty) * Number(i.unit_price);

export function billTotal(bill: Pick<BillRow, "tax_amount" | "service_amount" | "discount_amount">, items: Pick<BillItemRow, "qty" | "unit_price">[]): number {
  return items.reduce((s, i) => s + lineTotal(i), 0) + Number(bill.tax_amount) + Number(bill.service_amount) - Number(bill.discount_amount);
}

/**
 * Everyone's share. Shared items split evenly between their claimants; tax and service go
 * out in proportion to what each person had (or evenly when `tax_mode` is "even" or nothing is
 * assigned yet); discounts are proportional; each total is rounded to `rounding_unit` and the
 * payer absorbs the rounding remainder so the totals add up to the bill exactly.
 */
export function computeBill(bill: BillRow, items: BillItemRow[], participants: BillParticipantRow[], shares: BillShareRow[]): BillComputation {
  const unit = Number(bill.rounding_unit) || 1;
  const roundTo = (n: number) => Math.round(n / unit) * unit;
  const byItem = new Map<string, string[]>();
  for (const s of shares) byItem.set(s.item_id, [...(byItem.get(s.item_id) ?? []), s.participant_id]);
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const unassignedItems = items.filter((i) => !(byItem.get(i.id)?.length));
  const unassigned = unassignedItems.reduce((s, i) => s + lineTotal(i), 0);
  const assigned = subtotal - unassigned;
  const tax = Number(bill.tax_amount), service = Number(bill.service_amount), discount = Number(bill.discount_amount);
  const total = subtotal + tax + service - discount;

  const raw = participants.map((p) => {
    const lines: ShareLine[] = [];
    for (const i of items) {
      const who = byItem.get(i.id) ?? [];
      if (!who.includes(p.id)) continue;
      const fraction = 1 / who.length;
      lines.push({ itemId: i.id, label: i.name, qty: i.qty, fraction, amount: lineTotal(i) * fraction });
    }
    const itemsTotal = lines.reduce((s, l) => s + l.amount, 0);
    const weight = bill.tax_mode === "even" || assigned <= 0 ? 1 / Math.max(1, participants.length) : itemsTotal / assigned;
    const dWeight = assigned > 0 ? itemsTotal / assigned : 1 / Math.max(1, participants.length);
    return { participant: p, lines, itemsTotal, tax: tax * weight, service: service * weight, discount: discount * dWeight };
  });
  const payerId = bill.paid_by ?? null;
  const rounded = raw.map((r) => {
    const exact = r.itemsTotal + r.tax + r.service - r.discount;
    const t = roundTo(exact);
    return { ...r, rounding: t - exact, total: t, collects: 0 };
  });
  // Payer absorbs whatever rounding left over so everyone's totals add up to the bill (minus what's unassigned).
  const sum = rounded.reduce((s, r) => s + r.total, 0);
  const target = total - unassigned - (bill.tax_mode === "even" || assigned > 0 ? 0 : 0);
  const payer = rounded.find((r) => r.participant.id === payerId) ?? rounded[0];
  if (payer) { const diff = Math.round((target - sum) * 100) / 100; payer.total = Math.round((payer.total + diff) * 100) / 100; payer.rounding = Math.round((payer.rounding + diff) * 100) / 100; }
  if (payer && payerId) payer.collects = rounded.filter((r) => r.participant.id !== payerId).reduce((s, r) => s + r.total, 0);
  for (const r of rounded) { r.total = roundMoney(r.total, bill.currency); r.collects = roundMoney(r.collects, bill.currency); }
  return { subtotal, assigned, unassigned, unassignedItems, total, participants: rounded, payerId };
}

/** Shares that put every unassigned item on everyone ("Split rest evenly"). */
export function splitRestEvenly(bill: Pick<BillRow, "id" | "trip_id">, items: BillItemRow[], participants: BillParticipantRow[], shares: BillShareRow[]): BillShareRow[] {
  const has = new Set(shares.map((s) => s.item_id));
  const extra = items.filter((i) => !has.has(i.id)).flatMap((i) => participants.map((p) => ({ item_id: i.id, participant_id: p.id, bill_id: bill.id, trip_id: bill.trip_id })));
  return [...shares, ...extra];
}

export function toggleShare(shares: BillShareRow[], bill: Pick<BillRow, "id" | "trip_id">, itemId: string, participantId: string): BillShareRow[] {
  const on = shares.some((s) => s.item_id === itemId && s.participant_id === participantId);
  return on ? shares.filter((s) => !(s.item_id === itemId && s.participant_id === participantId)) : [...shares, { item_id: itemId, participant_id: participantId, bill_id: bill.id, trip_id: bill.trip_id }];
}

/** One-line-per-person summary for the OS share sheet. */
export function billShareText(bill: BillRow, comp: BillComputation, opts: { home?: { currency: string; rate: number } } = {}): string {
  const money = (n: number) => formatMoney(n, bill.currency);
  const home = (n: number) => (opts.home && opts.home.currency !== bill.currency ? ` (≈ ${formatMoney(roundMoney(n * opts.home.rate, opts.home.currency), opts.home.currency)})` : "");
  const lines = [`${bill.merchant} · ${money(comp.total)}${home(comp.total)}`];
  for (const p of comp.participants) {
    const what = p.lines.map((l) => `${l.fraction < 1 ? `${fractionLabel(l.fraction)} ` : ""}${l.label}`).join(", ");
    lines.push(`${p.participant.name}: ${money(p.total)}${home(p.total)}${what ? ` — ${what}` : ""}${p.participant.id === comp.payerId ? " (paid)" : ""}`);
  }
  if (comp.unassigned > 0) lines.push(`Unassigned: ${money(comp.unassigned)}`);
  lines.push("Sent from Voya · Split doesn't move money");
  return lines.join("\n");
}

export function fractionLabel(f: number): string {
  if (f >= 0.999) return "";
  const map: Record<string, string> = { "0.5": "½", "0.333": "⅓", "0.25": "¼", "0.2": "⅕", "0.667": "⅔", "0.75": "¾" };
  return map[f.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")] ?? map[(Math.round(f * 1000) / 1000).toString()] ?? `${Math.round(f * 100)}%`;
}

// ─── Claim links (no account) ────────────────────────────────────────────────
export interface ClaimView {
  merchant: string;
  currency: string;
  sender: string;
  you: { id: string; name: string };
  status: "open" | "settled";
  tax_amount: number;
  service_amount: number;
  discount_amount: number;
  tax_mode: TaxMode;
  rounding_unit: number;
  participants: { id: string; name: string }[];
  items: { id: string; name: string; local_name: string | null; qty: number; unit_price: number }[];
  shares: { item_id: string; participant_id: string }[];
}

/** What the claim page shows for "Your share so far": the same maths, on the token-scoped view. */
export function claimShare(view: ClaimView, chosen: Set<string>): { total: number; itemsTotal: number; tax: number } {
  const bill = { id: "b", trip_id: "t", merchant: view.merchant, currency: view.currency, status: "open", tax_amount: view.tax_amount, service_amount: view.service_amount, discount_amount: view.discount_amount, rounding_unit: view.rounding_unit, tax_mode: view.tax_mode, paid_by: null } as unknown as BillRow;
  const items = view.items.map((i) => ({ ...i, bill_id: "b", trip_id: "t", confidence: null, sort_order: 0, created_at: "" })) as BillItemRow[];
  const participants = view.participants.map((p) => ({ id: p.id, name: p.name, bill_id: "b", trip_id: "t", traveler_id: null, color: "#2F5D3A", home_currency: null, claim_token: null, claim_status: "none", claim_expires_at: "", created_at: "" })) as BillParticipantRow[];
  const shares = [
    ...view.shares.filter((s) => s.participant_id !== view.you.id).map((s) => ({ ...s, bill_id: "b", trip_id: "t" })),
    ...[...chosen].map((item_id) => ({ item_id, participant_id: view.you.id, bill_id: "b", trip_id: "t" })),
  ] as BillShareRow[];
  const me = computeBill(bill, items, participants, shares).participants.find((p) => p.participant.id === view.you.id);
  return { total: me?.total ?? 0, itemsTotal: me?.itemsTotal ?? 0, tax: (me?.tax ?? 0) + (me?.service ?? 0) };
}
