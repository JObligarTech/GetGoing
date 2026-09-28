import { describe, expect, it } from "vitest";
import { DEMO_CHRIS_ID, DEMO_NOW, DEMO_SARAH_ID, DEMO_USER_ID, demoAllEntitlements, demoBundle, demoEntitlements, demoPassMarks } from "./demo";
import {
  activePass, canGift, checkoutSummary, endedPass, extensionCoverage, extensionEndsAt, formatEnds, giftCandidates, giftEndsAt, giftStatusLabel, markForUser, midnightAfter, offlinePacks, passLabel, passSummary, passWindow,
  profileStats, readSettings, zonedMidnight,
} from "./pass";
import { createMockBilling, priceFor, unavailableBilling } from "./providers/billing";
import type { EntitlementRow, PassGiftRow } from "./db/database.types";

const TOKYO = "Asia/Tokyo";
const trip = demoBundle.trip;

describe("zoned midnights", () => {
  it("finds local midnight in any zone, including across DST", () => {
    expect(zonedMidnight("2027-03-15", TOKYO).toISOString()).toBe("2027-03-14T15:00:00.000Z");
    expect(zonedMidnight("2027-03-14", "America/Los_Angeles").toISOString()).toBe("2027-03-14T08:00:00.000Z"); // PDT starts Mar 14 2027
    expect(zonedMidnight("2027-03-13", "America/Los_Angeles").toISOString()).toBe("2027-03-13T08:00:00.000Z");
  });
  it("a gift accepted in the evening ends at midnight three days later, trip time", () => {
    const accepted = new Date("2027-03-15T12:00:00Z"); // 9 PM Tokyo, Mar 15
    const ends = giftEndsAt(accepted, TOKYO);
    expect(ends.toISOString()).toBe("2027-03-18T15:00:00.000Z"); // Mar 19 00:00 JST
    expect(formatEnds(ends, TOKYO)).toBe("Thu, Mar 18 · 11:59 PM GMT+9");
    expect(midnightAfter(accepted, TOKYO, 0).toISOString()).toBe("2027-03-15T15:00:00.000Z");
    expect(extensionEndsAt(ends, TOKYO, 7).toISOString()).toBe("2027-03-25T15:00:00.000Z");
  });
});

describe("pass windows", () => {
  it("single trip covers the trip's dates up to 14 nights; monthly and yearly run from now", () => {
    const w = passWindow("trip", DEMO_NOW, trip, "America/Los_Angeles");
    expect(w.startsAt).toEqual(DEMO_NOW);
    expect(w.endsAt.toISOString()).toBe("2027-03-29T15:00:00.000Z"); // through Mar 29, Tokyo
    const long = passWindow("trip", DEMO_NOW, { ...trip, end_date: "2027-04-20" }, TOKYO);
    expect(long.endsAt.toISOString()).toBe("2027-03-29T15:00:00.000Z"); // capped at 14 nights from Mar 15
    expect(passWindow("trip", DEMO_NOW, null, TOKYO).endsAt.toISOString()).toBe("2027-03-17T15:00:00.000Z");
    expect(passWindow("monthly", DEMO_NOW, trip, TOKYO).endsAt.toISOString()).toBe("2027-04-03T05:41:00.000Z");
    expect(passWindow("yearly", new Date("2028-02-29T00:00:00Z"), null, TOKYO).endsAt.toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });
  it("checkout summary spells out what happens after paying", () => {
    expect(checkoutSummary("yearly", trip, DEMO_NOW, TOKYO)?.afterPay).toBe("Yearly · renews Mar 3, 2028.");
    expect(checkoutSummary("trip", trip, DEMO_NOW, TOKYO)?.afterPay).toBe("Single trip · Japan 2027 · ends Mar 29, 2027.");
    expect(checkoutSummary("trip", trip, DEMO_NOW, TOKYO)?.blurb).toBe("Up to 14 days, Mar 15–29. One-time, no renewal.");
    expect(checkoutSummary("nope" as never, trip, DEMO_NOW, TOKYO)).toBeNull();
  });
});

describe("entitlements", () => {
  const gift: EntitlementRow = { ...demoEntitlements[0]!, id: "g", kind: "gift", trip_id: trip.id, starts_at: "2027-03-15T12:00:00Z", ends_at: "2027-03-18T15:00:00Z" };
  it("active, ended, labels and marks", () => {
    expect(activePass(demoEntitlements, trip.id, DEMO_NOW)?.kind).toBe("yearly");
    expect(passLabel(demoEntitlements[0]!, DEMO_NOW)).toBe("Yearly · 182 days left");
    expect(activePass([gift], trip.id, new Date("2027-03-16T00:00:00Z"))?.id).toBe("g");
    expect(activePass([gift], "other-trip", new Date("2027-03-16T00:00:00Z"))).toBeNull();
    expect(endedPass([gift], trip.id, new Date("2027-03-20T00:00:00Z"))?.id).toBe("g");
    expect(endedPass(demoEntitlements, trip.id, DEMO_NOW)).toBeNull();
    expect(passLabel(gift, new Date("2027-03-17T00:00:00Z"))).toBe("Gifted · 2 days left");
    expect(markForUser(demoPassMarks(), DEMO_USER_ID)).toBe("pass");
    expect(markForUser(demoPassMarks(), DEMO_CHRIS_ID)).toBeNull();
    expect(markForUser([{ user_id: "x", kind: "gift" }], "x")).toBe("gifted");
  });
  it("profile summary", () => {
    expect(passSummary(demoEntitlements[0]!, DEMO_NOW, TOKYO)).toEqual({ title: "Atlas Premium Pass · yearly", detail: "Renews Sep 1, 2027" });
    expect(passSummary(gift, new Date("2027-03-17T00:00:00Z"), TOKYO).detail).toBe("Gifted · 2 days left · ends Thu, Mar 18 · 11:59 PM GMT+9");
    expect(passSummary(null, DEMO_NOW, TOKYO).detail).toBe("Upgrade");
  });
});

describe("gifting", () => {
  const sent: PassGiftRow = { id: "pg1", trip_id: trip.id, giver_id: DEMO_USER_ID, traveler_id: "t2", recipient_id: null, code: "a".repeat(24), status: "sent", days: 3, created_at: DEMO_NOW.toISOString(), expires_at: "2027-04-02T05:41:00Z", accepted_at: null, ends_at: null };
  it("only monthly/yearly members gift, once per trip", () => {
    expect(canGift(demoEntitlements, trip.id, [], DEMO_USER_ID, DEMO_NOW)).toEqual({ ok: true });
    expect(canGift(demoEntitlements, trip.id, [sent], DEMO_USER_ID, DEMO_NOW)).toMatchObject({ ok: false, reason: "You've used this trip's gift." });
    expect(canGift([{ ...demoEntitlements[0]!, kind: "trip", trip_id: trip.id }], trip.id, [], DEMO_USER_ID, DEMO_NOW)).toMatchObject({ ok: false });
    expect(canGift([], trip.id, [], DEMO_CHRIS_ID, DEMO_NOW)).toMatchObject({ ok: false });
  });
  it("candidates explain who can receive it", () => {
    const c = giftCandidates(demoBundle.travelers, demoPassMarks(), DEMO_USER_ID);
    expect(c.map((x) => [x.traveler.name, x.status, x.eligible])).toEqual([
      ["Chris", "Voya account · no pass", true],
      ["Daniel", "Guest · will need to create an account", true],
      ["Sarah", "Already has Atlas Premium Pass · yearly", false],
    ]);
    expect(demoAllEntitlements.some((e) => e.user_id === DEMO_SARAH_ID)).toBe(true);
  });
  it("status copy and extension coverage", () => {
    expect(giftStatusLabel(sent, "Chris", DEMO_NOW)).toBe("Gift sent · waiting for Chris");
    expect(giftStatusLabel({ ...sent, status: "accepted", ends_at: "2027-03-18T15:00:00Z" }, "Chris", DEMO_NOW)).toBe("Gifted · Chris accepted");
    expect(giftStatusLabel({ ...sent, status: "accepted", ends_at: "2027-03-18T15:00:00Z" }, "Chris", new Date("2027-03-20T00:00:00Z"))).toBe("Gift to Chris ended");
    expect(giftStatusLabel({ ...sent, expires_at: "2027-03-01T00:00:00Z" }, "Chris", DEMO_NOW)).toBe("Gift link expired");
    const giftEnd = new Date("2027-03-18T15:00:00Z");
    expect(extensionCoverage(giftEnd, 7, trip, TOKYO).text).toBe("7 days covers you through Thu, Mar 25 · 4 more nights after that.");
    expect(extensionCoverage(giftEnd, 7, { ...trip, end_date: "2027-03-24" }, TOKYO).text).toBe("7 days covers you through Thu, Mar 25 · the rest of your Tokyo and Kyoto nights.");
    expect(extensionCoverage(giftEnd, 1, { ...trip, end_date: null }, TOKYO).text).toBe("1 day covers you through Fri, Mar 19.");
  });
});

describe("offline packs, settings, stats", () => {
  it("one map per first city, the rest grouped Wi-Fi only, and the language pack", () => {
    const packs = offlinePacks(demoBundle);
    expect(packs.map((p) => [p.title, p.sizeMb, p.wifiOnly])).toEqual([
      ["Japan 2027 · offline pack", null, false],
      ["Tokyo map", 412, false],
      ["Kyoto & Osaka maps", 290, true],
      ["Japanese translation pack", 68, false],
    ]);
    expect(offlinePacks({ ...demoBundle, trip: { ...trip, cities: ["Reykjavik"], local_language: null } }).map((p) => p.title)).toEqual(["Japan 2027 · offline pack", "Reykjavik map"]);
  });
  it("settings tolerate junk; stats count across trips", () => {
    expect(readSettings(null).showHomeTime).toBe(true);
    expect(readSettings({ showHomeTime: false, quickAction: "yes", other: 1 })).toMatchObject({ showHomeTime: false, quickAction: true });
    expect(readSettings([1, 2] as never).suggestLocalCurrency).toBe(true);
    expect(profileStats([{ place_count: 38, countries: ["JP"] }, { place_count: 5, countries: ["PT", "ES"] }, { place_count: 0, countries: ["JP"] }])).toEqual({ trips: 3, places: 43, countries: 3 });
  });
});

describe("billing providers", () => {
  it("the mock pays instantly with a masked method and restores by user; the placeholder never charges", async () => {
    const billing = createMockBilling({ now: () => DEMO_NOW, randomId: () => "r1" });
    const r = await billing.purchase({ plan: "yearly", userId: DEMO_CHRIS_ID, tripId: null, method: "apple_pay" });
    expect(r).toMatchObject({ status: "paid", receipt: { receiptId: "mock_r1", amount: 49.99, paidWith: "Apple Pay ·· 4421", paidAt: DEMO_NOW.toISOString(), days: null } });
    const ext = await billing.purchase({ plan: "extension", userId: DEMO_CHRIS_ID, tripId: trip.id, days: 7, method: "card" });
    expect(ext).toMatchObject({ status: "paid", receipt: { amount: 0.99, days: 7, paidWith: "Card ·· 4421" } });
    expect(await billing.purchase({ plan: "extension", userId: DEMO_CHRIS_ID, tripId: trip.id, days: 9, method: "card" })).toMatchObject({ status: "unavailable" });
    expect((await billing.restore(DEMO_CHRIS_ID)).length).toBe(2);
    expect(await billing.restore(DEMO_USER_ID)).toEqual([]);
    expect(priceFor("monthly")).toBe(4.99);
    expect(await unavailableBilling.purchase({ plan: "trip", userId: "u", tripId: null, method: "card" })).toMatchObject({ status: "unavailable" });
  });
});
