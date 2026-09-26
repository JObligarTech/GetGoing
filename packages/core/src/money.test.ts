import { describe, expect, it, vi } from "vitest";
import { demoBundle, demoProfile } from "./demo";
import { mockFx } from "./providers/mock";
import { commonPrices, convert, createFxCache, currencyLabel, currencySymbol, formatRate, keypadPress, keypadValue, quickAmounts, tripCurrencies, updatedLabel, withTip } from "./money";

describe("conversion", () => {
  it("rounds to the quote currency's minor units", () => {
    expect(convert(100, 150.2, "JPY")).toBe(15020);
    expect(convert(1200, 1 / 150.2, "USD")).toBe(7.99);
    expect(withTip(2800, 15, "JPY")).toBe(3220);
    expect(withTip(41.5, 18, "USD")).toBe(48.97);
  });
  it("labels rates and symbols", () => {
    expect(formatRate({ base: "USD", quote: "JPY", rate: 150.2, asOf: "" })).toBe("1 USD = 150.20 JPY");
    expect(formatRate({ base: "JPY", quote: "USD", rate: 0.00666, asOf: "" })).toBe("1 JPY = 0.0067 USD");
    expect(currencySymbol("JPY")).toBe("¥");
    expect(currencySymbol("USD")).toBe("$");
  });
  it("describes when a rate was updated", () => {
    const now = new Date("2027-03-03T05:41:00Z");
    expect(updatedLabel("2027-03-03T05:39:00Z", now)).toBe("Updated 2 min ago");
    expect(updatedLabel("2027-03-03T05:41:00Z", now)).toBe("Updated just now");
    expect(updatedLabel("2027-03-03T02:41:00Z", now)).toBe("Updated 3 h ago");
    expect(updatedLabel("2027-03-02", now)).toBe("Updated yesterday");
    expect(updatedLabel("2026-09-18", now)).toBe("Updated Sep 18");
  });
});

describe("keypad", () => {
  it("builds a number one key at a time", () => {
    let d = "0";
    for (const k of ["1", "0", "0", ".", "5"]) d = keypadPress(d, k, "USD");
    expect(d).toBe("100.5");
    expect(keypadPress(d, "0", "USD")).toBe("100.50");
    expect(keypadPress("100.50", "1", "USD")).toBe("100.50"); // two decimals max
    expect(keypadPress("100.50", "backspace", "USD")).toBe("100.5");
    expect(keypadPress("1", "backspace", "USD")).toBe("0");
    expect(keypadPress("0", "00", "USD")).toBe("0");
    expect(keypadPress("5", "00", "USD")).toBe("500");
    expect(keypadPress("12", ".", "JPY")).toBe("12"); // yen has no decimals
    expect(keypadPress("0", ".", "USD")).toBe("0.");
    expect(keypadValue("0.")).toBe(0);
    expect(keypadPress("123456789012", "3", "USD")).toBe("123456789012");
    expect(keypadPress("42", "clear", "USD")).toBe("0");
  });
});

describe("trip currencies", () => {
  it("puts the local currency first with the country label, then the extras", () => {
    expect(tripCurrencies(demoBundle)).toEqual([{ code: "JPY", label: "Japan · local", primary: true }, { code: "KRW", label: "KRW · Seoul layover", primary: false }]);
    expect(currencyLabel("USD", demoBundle.trip, demoProfile, demoBundle.tripCurrencies)).toBe("Home");
    expect(currencyLabel("JPY", demoBundle.trip, demoProfile)).toBe("Japan · local");
    expect(currencyLabel("KRW", demoBundle.trip, demoProfile, demoBundle.tripCurrencies)).toBe("KRW · Seoul layover");
    expect(currencyLabel("EUR", demoBundle.trip, demoProfile)).toBe("Euro");
  });
  it("quick amounts scale with the currency", () => {
    expect(quickAmounts("USD")).toEqual([1, 5, 10, 20, 50, 100]);
    expect(quickAmounts("JPY")[0]).toBe(100);
    expect(commonPrices("JPY")[0]).toEqual({ label: "Ramen bowl", amount: 1200 });
    expect(commonPrices("XXX")).toEqual([]);
  });
});

describe("fx cache", () => {
  it("caches within the TTL and serves the last rate when the provider fails", async () => {
    let t = 0;
    const now = () => new Date(1_000_000 + t);
    const rate = vi.fn(mockFx.rate);
    const cache = createFxCache({ rate }, { ttlMs: 1000, now });
    const a = await cache.rate("USD", "JPY");
    expect(a).toMatchObject({ rate: 149.7, stale: false, fromCache: false });
    const b = await cache.rate("USD", "JPY");
    expect(b.fromCache).toBe(true);
    expect(rate).toHaveBeenCalledTimes(1);
    t = 2000;
    rate.mockRejectedValueOnce(new Error("offline"));
    const c = await cache.rate("USD", "JPY");
    expect(c).toMatchObject({ rate: 149.7, stale: true, fromCache: true });
    expect((await cache.rate("USD", "USD")).rate).toBe(1);
  });
  it("falls back to the persisted store, and throws when there is nothing at all", async () => {
    const store = { load: vi.fn(async () => ({ base: "USD", quote: "EUR", rate: 0.9, asOf: "2026-01-01" })), save: vi.fn() };
    const failing = { rate: async () => { throw new Error("offline"); } };
    const cache = createFxCache(failing, { store });
    expect(await cache.rate("USD", "EUR")).toMatchObject({ rate: 0.9, stale: true });
    store.load.mockResolvedValueOnce(null as never);
    await expect(cache.rate("USD", "GBP")).rejects.toThrow("offline");
  });
});
