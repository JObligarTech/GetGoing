import { describe, expect, it } from "vitest";
import { AFURI_BILL, DEMO_NOW, demoBundle, demoEntitlements } from "./demo";
import { billBundle } from "./domain";
import { mockOcr } from "./providers/mock";
import { billShareText, billTotal, claimShare, computeBill, fractionLabel, parseReceipt, parseReceiptLine, splitRestEvenly, toggleShare, type ClaimView } from "./split";
import { activePass, passLabel } from "./pass";

const afuri = () => billBundle(demoBundle, AFURI_BILL)!;

describe("receipt parsing", () => {
  it("reads quantity and line price", () => {
    expect(parseReceiptLine("柚子塩らーめん ×2 ¥2,400")).toEqual({ label: "柚子塩らーめん", qty: 2, price: 2400 });
    expect(parseReceiptLine("2x Draft beer 1,400")).toEqual({ label: "Draft beer", qty: 2, price: 1400 });
    expect(parseReceiptLine("Gyoza 5個 ¥600")).toEqual({ label: "Gyoza", qty: 5, price: 600 });
    expect(parseReceiptLine("合計 ¥6,655")).toEqual({ label: "合計", qty: 1, price: 6655 });
  });
  it("turns the mock receipt into items, tax and total, flagging the misread line", async () => {
    const r = parseReceipt(await mockOcr.recognize(new ArrayBuffer(0), { document: "receipt" }));
    expect(r.merchant).toBe("AFURI 原宿");
    expect(r.items.map((i) => [i.localName, i.qty, i.unitPrice])).toEqual([["柚子塩らーめん", 2, 1200], ["餃子", 1, 600], ["生ビール", 2, 700], ["コーラ", 1, 300], ["つけ麹", 1, 1350]]);
    expect(r).toMatchObject({ subtotal: 6050, tax: 605, taxLabel: "消費税10%", total: 6655, service: null, flagged: 1 });
  });
});

describe("bill maths", () => {
  it("matches the mockup: shared gyoza, proportional tax, whole-yen rounding, payer collects", () => {
    const { bill, items, participants, shares } = afuri();
    expect(billTotal(bill, items)).toBe(6655);
    const c = computeBill(bill, items, participants, shares);
    expect(c.subtotal).toBe(6050);
    expect(c.unassigned).toBe(300);
    expect(c.unassignedItems.map((i) => i.name)).toEqual(["Coke"]);
    const by = Object.fromEntries(c.participants.map((p) => [p.participant.name, p]));
    expect(by.Joe!.lines.map((l) => [l.label, l.fraction, l.amount])).toEqual([["Yuzu Shio Ramen", 0.5, 1200], ["Gyoza", 0.5, 300], ["Draft beer", 0.5, 700]]);
    expect(by.Joe!.total).toBe(2431);   // 2200 + 231.48 tax, rounded to the yen
    expect(by.Chris!.total).toBe(1824); // 300 + 1350 + 174 tax
    expect(by.Daniel!.total).toBe(774); // 700 + 74 tax
    expect(by.Sarah!.total).toBe(1326); // 1200 + 126 tax
    // Everyone's totals add up to the bill minus what's still unassigned; the payer collects the rest.
    expect(c.participants.reduce((s, p) => s + p.total, 0)).toBe(6655 - 300);
    expect(by.Joe!.collects).toBe(1824 + 774 + 1326);
  });
  it("splits the rest evenly and shares tax evenly when asked", () => {
    const { bill, items, participants, shares } = afuri();
    const all = splitRestEvenly(bill, items, participants, shares);
    const c = computeBill({ ...bill, tax_mode: "even" }, items, participants, all);
    expect(c.unassigned).toBe(0);
    expect(c.participants.reduce((s, p) => s + p.total, 0)).toBe(6655);
    for (const p of c.participants) expect(Math.round(p.tax)).toBeGreaterThanOrEqual(151); // 605 / 4
    expect(toggleShare(shares, bill, items[3]!.id, participants[2]!.id)).toHaveLength(shares.length + 1);
    expect(toggleShare(toggleShare(shares, bill, items[3]!.id, participants[2]!.id), bill, items[3]!.id, participants[2]!.id)).toHaveLength(shares.length);
  });
  it("handles discounts, service and cent rounding", () => {
    const { bill, items, participants, shares } = afuri();
    const c = computeBill({ ...bill, currency: "EUR", rounding_unit: 0.01, service_amount: 100, discount_amount: 50 }, items, participants, splitRestEvenly(bill, items, participants, shares));
    expect(c.total).toBe(6050 + 605 + 100 - 50);
    expect(Math.round(c.participants.reduce((s, p) => s + p.total, 0) * 100) / 100).toBe(c.total);
  });
  it("labels fractions and writes the share text", () => {
    expect(fractionLabel(0.5)).toBe("½");
    expect(fractionLabel(1 / 3)).toBe("⅓");
    expect(fractionLabel(1)).toBe("");
    const { bill, items, participants, shares } = afuri();
    const text = billShareText(bill, computeBill(bill, items, participants, shares), { home: { currency: "USD", rate: 1 / 149.7 } });
    expect(text).toContain("Afuri Ramen Harajuku · ¥6,655 (≈ $44.46)");
    expect(text).toContain("Joe: ¥2,431 (≈ $16.24) — ½ Yuzu Shio Ramen, ½ Gyoza, ½ Draft beer (paid)");
    expect(text).toContain("Unassigned: ¥300");
    expect(text).toContain("Split doesn't move money");
  });
});

describe("claim link", () => {
  it("computes 'your share so far' from the token-scoped view", () => {
    const { bill, items, participants, shares } = afuri();
    const view: ClaimView = {
      merchant: bill.merchant, currency: "JPY", sender: "Joe", you: { id: participants[1]!.id, name: "Chris" }, status: "open",
      tax_amount: 605, service_amount: 0, discount_amount: 0, tax_mode: "proportional", rounding_unit: 1,
      participants: participants.map((p) => ({ id: p.id, name: p.name })),
      items: items.map((i) => ({ id: i.id, name: i.name, local_name: i.local_name, qty: i.qty, unit_price: i.unit_price })),
      shares: shares.map((s) => ({ item_id: s.item_id, participant_id: s.participant_id })),
    };
    expect(claimShare(view, new Set([items[1]!.id, items[4]!.id])).total).toBe(1824);
    expect(claimShare(view, new Set()).total).toBe(0);
  });
});

describe("Atlas Premium Pass", () => {
  it("finds the active pass for a trip and describes what's left", () => {
    expect(activePass(demoEntitlements, demoBundle.trip.id, DEMO_NOW)?.kind).toBe("yearly");
    expect(activePass(demoEntitlements, demoBundle.trip.id, new Date("2028-01-01T00:00:00Z"))).toBeNull();
    const gift = { ...demoEntitlements[0]!, id: "g", kind: "gift" as const, trip_id: "other", starts_at: "2027-03-01T00:00:00Z", ends_at: "2027-03-06T00:00:00Z" };
    expect(activePass([gift], demoBundle.trip.id, DEMO_NOW)).toBeNull(); // gifted for another trip
    expect(activePass([gift], "other", DEMO_NOW)?.id).toBe("g");
    expect(passLabel(gift, DEMO_NOW)).toBe("Gifted · 3 days left");
  });
});
