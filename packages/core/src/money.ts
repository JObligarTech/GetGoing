/**
 * Currency — conversion maths, keypad state, quick amounts, tips, rate caching with a
 * stale fallback for offline use, and the "Common in Japan" reference prices.
 */
import type { TripCurrencyRow } from "./db/database.types";
import type { Trip, TripBundle } from "./domain";
import type { FxProvider, FxRate } from "./providers/types";
import { countryName } from "./translate";

/** Currencies without minor units (rounded to whole numbers). */
export const ZERO_DECIMAL = new Set(["JPY", "KRW", "IDR", "VND", "HUF", "CLP", "ISK", "TWD", "UGX", "XAF", "XOF"]);

export function decimalsFor(currency: string): number {
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}

export function roundMoney(amount: number, currency: string): number {
  const f = 10 ** decimalsFor(currency);
  return Math.round(amount * f) / f;
}

export function convert(amount: number, rate: number, quote: string): number {
  return roundMoney(amount * rate, quote);
}

/** "Japanese Yen" */
export function currencyName(code: string, locale = "en"): string {
  try { return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code; } catch { return code; }
}

/** "¥" for JPY, "$" for USD, "€" for EUR; the code itself when the locale has no symbol. */
export function currencySymbol(code: string, locale = "en-US"): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(1).find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch { return code; }
}

/** "1 USD = 150.20 JPY" */
export function formatRate(rate: FxRate): string {
  const digits = rate.rate >= 100 ? 2 : 4;
  return `1 ${rate.base} = ${rate.rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits })} ${rate.quote}`;
}

/** "Updated just now" / "Updated 2 min ago" / "Updated 3 h ago" / "Updated yesterday" / "Updated Sep 18". */
export function updatedLabel(asOf: string | Date, now: Date, locale = "en-US"): string {
  const at = typeof asOf === "string" ? new Date(asOf.length === 10 ? `${asOf}T00:00:00Z` : asOf) : asOf;
  const diffMin = Math.round((now.getTime() - at.getTime()) / 60_000);
  if (!Number.isFinite(diffMin)) return "Updated";
  if (diffMin < 1) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `Updated ${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Updated yesterday";
  if (d < 7) return `Updated ${d} days ago`;
  return `Updated ${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(at)}`;
}

/** Quick amounts in the base currency: $1 … $100, or the local equivalents for big-number currencies. */
export function quickAmounts(currency: string): number[] {
  const table: Record<string, number[]> = {
    JPY: [100, 500, 1000, 2000, 5000, 10000],
    KRW: [1000, 5000, 10000, 20000, 50000, 100000],
    IDR: [10000, 20000, 50000, 100000, 200000, 500000],
    VND: [10000, 20000, 50000, 100000, 200000, 500000],
    INR: [100, 200, 500, 1000, 2000, 5000],
    THB: [20, 50, 100, 200, 500, 1000],
  };
  return table[currency] ?? [1, 5, 10, 20, 50, 100];
}

export const TIP_PRESETS = [10, 15, 18, 20];

export function withTip(amount: number, percent: number, currency: string): number {
  return roundMoney(amount * (1 + percent / 100), currency);
}

/** Keypad input as a string so "1." and "0.5" survive; max 12 digits, one point, 2 decimals (0 for yen-like). */
export function keypadPress(display: string, key: string, currency: string): string {
  const maxDec = decimalsFor(currency);
  if (key === "clear") return "0";
  if (key === "backspace") { const n = display.slice(0, -1); return n === "" || n === "-" ? "0" : n; }
  if (key === "." ) { if (maxDec === 0 || display.includes(".")) return display; return `${display}.`; }
  if (key === "00") return display === "0" ? display : keypadPress(keypadPress(display, "0", currency), "0", currency);
  if (!/^\d$/.test(key)) return display;
  const [whole = "", frac] = display.split(".");
  if (frac !== undefined) return frac.length >= maxDec ? display : `${display}${key}`;
  if (whole.replace(/^0+/, "").length >= 12) return display;
  return whole === "0" ? key : `${display}${key}`;
}

export function keypadValue(display: string): number {
  const n = Number(display);
  return Number.isFinite(n) ? n : 0;
}

export interface TripCurrency { code: string; label: string; primary: boolean }

/** The trip's local currency first (labelled with the country), then the extra ones ("KRW · Seoul layover"). */
export function tripCurrencies(bundle: Pick<TripBundle, "trip" | "tripCurrencies">): TripCurrency[] {
  const out: TripCurrency[] = [];
  const local = bundle.trip.local_currency;
  if (local) out.push({ code: local, label: `${countryName(bundle.trip.countries[0]) ?? "Trip"} · local`, primary: true });
  for (const c of [...bundle.tripCurrencies].sort((a, b) => a.sort_order - b.sort_order)) {
    if (c.code === local) continue;
    out.push({ code: c.code, label: c.label ?? currencyName(c.code), primary: false });
  }
  return out;
}

export function currencyLabel(code: string, trip: Pick<Trip, "local_currency" | "countries">, profile: { home_currency: string }, extras: Pick<TripCurrencyRow, "code" | "label">[] = []): string {
  if (code === profile.home_currency) return "Home";
  if (code === trip.local_currency) return `${countryName(trip.countries[0]) ?? "Trip"} · local`;
  return extras.find((e) => e.code === code)?.label ?? currencyName(code);
}

export interface CommonPrice { label: string; amount: number }

/** Reference prices shown under the converter. Static, per currency; the heading comes from the trip's country. */
export const COMMON_PRICES: Record<string, CommonPrice[]> = {
  JPY: [{ label: "Ramen bowl", amount: 1200 }, { label: "Train fare", amount: 180 }, { label: "Shibuya Sky ticket", amount: 2500 }, { label: "Convenience-store coffee", amount: 150 }, { label: "Taxi, first 1 km", amount: 500 }],
  KRW: [{ label: "Bibimbap", amount: 9000 }, { label: "Subway fare", amount: 1400 }, { label: "Coffee", amount: 4500 }, { label: "Taxi base fare", amount: 4800 }],
  EUR: [{ label: "Espresso", amount: 1.2 }, { label: "Metro ticket", amount: 1.8 }, { label: "Pastel de nata", amount: 1.5 }, { label: "Lunch menu", amount: 12 }],
  IDR: [{ label: "Nasi goreng", amount: 35000 }, { label: "Scooter rental, day", amount: 80000 }, { label: "Coffee", amount: 30000 }, { label: "Temple entry", amount: 50000 }],
  GBP: [{ label: "Flat white", amount: 3.6 }, { label: "Tube fare", amount: 2.8 }, { label: "Pub lunch", amount: 15 }],
  USD: [{ label: "Coffee", amount: 4.5 }, { label: "Subway fare", amount: 2.9 }, { label: "Lunch", amount: 15 }],
};

export function commonPrices(currency: string): CommonPrice[] {
  return COMMON_PRICES[currency] ?? [];
}

export interface CachedRate extends FxRate { stale: boolean; fromCache: boolean }
export interface FxCacheStore { load(key: string): Promise<FxRate | null> | FxRate | null; save(key: string, rate: FxRate): Promise<void> | void }

/**
 * Wraps an FxProvider with a TTL cache and a stale fallback: when the provider is
 * unreachable the last known rate is returned with `stale: true`, so the converter still
 * works on the plane. `store` is optional persistence (AsyncStorage on mobile).
 */
export function createFxCache(provider: FxProvider, opts: { ttlMs?: number; store?: FxCacheStore; now?: () => Date } = {}) {
  const ttl = opts.ttlMs ?? 60 * 60 * 1000;
  const mem = new Map<string, { rate: FxRate; fetchedAt: number }>();
  const now = opts.now ?? (() => new Date());
  return {
    async rate(base: string, quote: string, o?: { signal?: AbortSignal }): Promise<CachedRate> {
      if (base === quote) return { base, quote, rate: 1, asOf: now().toISOString(), stale: false, fromCache: false };
      const key = `${base}:${quote}`;
      const hit = mem.get(key);
      if (hit && now().getTime() - hit.fetchedAt < ttl) return { ...hit.rate, stale: false, fromCache: true };
      try {
        const fresh = await provider.rate(base, quote, o);
        mem.set(key, { rate: fresh, fetchedAt: now().getTime() });
        await opts.store?.save(key, fresh);
        return { ...fresh, stale: false, fromCache: false };
      } catch (err) {
        const last = hit?.rate ?? (await opts.store?.load(key)) ?? null;
        if (!last) throw err;
        return { ...last, stale: true, fromCache: true };
      }
    },
    /** For tests and the "clear cached rates" affordance. */
    clear() { mem.clear(); },
  };
}
export type FxCache = ReturnType<typeof createFxCache>;
