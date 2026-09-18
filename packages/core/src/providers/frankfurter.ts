/** Frankfurter (ECB rates) — keyless FX provider. Rates are published daily. */
import type { FxProvider } from "./types";

export function createFrankfurterFx(opts: { endpoint?: string; fetchImpl?: typeof fetch } = {}): FxProvider {
  const endpoint = opts.endpoint ?? "https://api.frankfurter.dev/v1/latest";
  const f = opts.fetchImpl ?? fetch;
  return {
    async rate(base, quote, o) {
      if (base === quote) return { base, quote, rate: 1, asOf: new Date().toISOString() };
      const url = new URL(endpoint);
      url.searchParams.set("base", base);
      url.searchParams.set("symbols", quote);
      const res = await f(url, { signal: o?.signal });
      if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
      const body = (await res.json()) as { date: string; rates: Record<string, number> };
      const rate = body.rates[quote];
      if (rate === undefined) throw new Error(`No rate ${base}→${quote}`);
      return { base, quote, rate, asOf: body.date };
    },
  };
}
