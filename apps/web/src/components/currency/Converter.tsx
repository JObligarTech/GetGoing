"use client";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { ArrowDownUp, Bookmark, Delete, Percent, Plus, Trash2, WifiOff, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  commonPrices, convert, currencyLabel, currencyName, currencySymbol, formatMoney, formatRate, keypadPress, keypadValue, quickAmounts, TIP_PRESETS, updatedLabel,
  type CachedRate, type TripCurrency, type TripCurrencyRow,
} from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Card, Chip, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { createLocalStore, useOnline } from "@/lib/local-store";
import { cx } from "@/lib/utils";

export interface ConverterProps {
  tripId: string;
  tripName: string;
  countryName: string | null;
  homeCurrency: string;
  localCurrency: string | null;
  tripCurrencies: TripCurrency[];
  extras: TripCurrencyRow[];
  initialRate: CachedRate | null;
  /** Server "now" (fixed in demo mode) so "Updated 2 min ago" is deterministic. */
  nowIso: string;
  rateAction: (base: unknown, quote: unknown) => Promise<CachedRate | { error: string }>;
  addCurrencyAction: (input: unknown) => Promise<TripCurrencyRow | { error: string }>;
  removeCurrencyAction: (tripId: unknown, code: unknown) => Promise<{ ok: true } | { error: string }>;
}

interface Adjust { kind: "tip" | "off"; pct: number }
interface SavedAmount { id: string; base: string; quote: string; amount: number; converted: number; at: string }
const savedStore = createLocalStore<SavedAmount[]>("voya.currency.saved", []);
const RATES_KEY = "voya.currency.rates";
const ADD_OPTIONS = ["EUR", "GBP", "KRW", "CNY", "THB", "VND", "IDR", "SGD", "TWD", "HKD", "AUD", "CAD", "CHF", "INR", "MXN", "BRL", "NZD", "PHP", "USD", "JPY"];

/**
 * Currency converter. Keypad or typed amount on the home side, the trip's currency on the
 * other; swap flips them. Rates come from the server cache and are remembered on this device
 * so the converter keeps working offline (marked "cached").
 */
export function Converter({ tripId, tripName, countryName: country, homeCurrency, localCurrency, tripCurrencies, extras: initialExtras, initialRate, nowIso, rateAction, addCurrencyAction, removeCurrencyAction }: ConverterProps) {
  const reduce = useReducedMotion();
  const [base, setBase] = useState(homeCurrency);
  const [quote, setQuote] = useState(localCurrency ?? tripCurrencies[0]?.code ?? "EUR");
  const [display, setDisplay] = useState("100");
  const [rate, setRate] = useState<CachedRate | null>(initialRate);
  const [rateError, setRateError] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<Adjust | null>(null);
  const [picker, setPicker] = useState<"tip" | "off" | null>(null);
  const [extras, setExtras] = useState(initialExtras);
  const saved = savedStore.use();
  const [status, setStatus] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const online = useOnline();
  const [pending, start] = useTransition();
  const addRef = useRef<HTMLDialogElement>(null);
  const amountId = useId();
  const now = new Date(nowIso);

  // Per-device memory: saved amounts and the last rates (offline fallback). Never shared, never sent anywhere.
  const persistSaved = (list: SavedAmount[]) => savedStore.set(list);
  const rememberRate = (r: CachedRate) => { try { const all = JSON.parse(localStorage.getItem(RATES_KEY) ?? "{}") as Record<string, CachedRate>; all[`${r.base}:${r.quote}`] = r; localStorage.setItem(RATES_KEY, JSON.stringify(all)); } catch { /* ignore */ } };
  const recallRate = (b: string, q: string): CachedRate | null => { try { const all = JSON.parse(localStorage.getItem(RATES_KEY) ?? "{}") as Record<string, CachedRate>; const r = all[`${b}:${q}`]; return r ? { ...r, stale: true, fromCache: true } : null; } catch { return null; } };

  const fetchRate = useCallback((b: string, q: string) => {
    start(async () => {
      const r = await rateAction(b, q);
      if ("error" in r) { const cached = recallRate(b, q); if (cached) { setRate(cached); setRateError(null); } else { setRate(null); setRateError(r.error); } return; }
      setRate(r); setRateError(null); rememberRate(r);
    });
  }, [rateAction]);

  useEffect(() => {
    if (rate && rate.base === base && rate.quote === quote) { rememberRate(rate); return; }
    fetchRate(base, quote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, quote]);

  const amount = keypadValue(display);
  const adjusted = adjust ? Math.round(amount * (adjust.kind === "tip" ? 1 + adjust.pct / 100 : 1 - adjust.pct / 100) * 100) / 100 : amount;
  const converted = rate ? convert(adjusted, rate.rate, quote) : null;
  const press = (k: string) => setDisplay((d) => keypadPress(d, k, base));
  const swap = () => {
    if (converted != null) setDisplay(String(converted));
    setBase(quote); setQuote(base); setAdjust(null);
    setStatus(`Now converting ${quote} to ${base}.`);
  };
  const pickQuote = (code: string) => { if (code === base) { setBase(quote === code ? homeCurrency : quote); } setQuote(code); };
  const save = () => {
    if (converted == null) return;
    const row: SavedAmount = { id: crypto.randomUUID(), base, quote, amount: adjusted, converted, at: new Date().toISOString() };
    persistSaved([row, ...saved].slice(0, 20));
    setStatus(`Saved ${formatMoney(adjusted, base)} = ${formatMoney(converted, quote)} on this device.`);
  };
  const addCurrency = (fd: FormData) => start(async () => {
    const r = await addCurrencyAction({ tripId, code: fd.get("code"), label: fd.get("label") || null });
    if ("error" in r) { setStatus(r.error); return; }
    setExtras((e) => (e.some((x) => x.code === r.code) ? e : [...e, r]));
    setAddOpen(false); setQuote(r.code);
    setStatus(`${r.code} added to ${tripName}.`);
  });
  const removeCurrency = (code: string) => start(async () => {
    const r = await removeCurrencyAction(tripId, code);
    if ("error" in r) { setStatus(r.error); return; }
    setExtras((e) => e.filter((x) => x.code !== code));
    if (quote === code) setQuote(localCurrency ?? homeCurrency);
    setStatus(`${code} removed.`);
  });

  useEffect(() => {
    const d = addRef.current; if (!d) return;
    if (addOpen && !d.open) { d.showModal(); d.querySelector<HTMLElement>("select")?.focus(); }
    if (!addOpen && d.open) d.close();
  }, [addOpen]);

  const chips: TripCurrency[] = [...tripCurrencies.filter((c) => c.primary), ...extras.filter((e) => e.code !== localCurrency).map((e) => ({ code: e.code, label: e.label ?? currencyName(e.code), primary: false }))];
  const trip = { local_currency: localCurrency, countries: country ? [country] : [] };
  const label = (code: string) => (code === homeCurrency ? "Home" : code === localCurrency ? `${country ?? "Trip"} · local` : currencyLabel(code, trip, { home_currency: homeCurrency }, extras));
  const common = localCurrency ? commonPrices(localCurrency) : [];
  const commonRate = rate && ((rate.base === localCurrency && rate.quote === homeCurrency) ? rate.rate : (rate.quote === localCurrency && rate.base === homeCurrency) ? 1 / rate.rate : null);
  const keys: { k: string; label?: string; aria?: string }[][] = [
    [{ k: "1" }, { k: "2" }, { k: "3" }],
    [{ k: "4" }, { k: "5" }, { k: "6" }],
    [{ k: "7" }, { k: "8" }, { k: "9" }],
    [{ k: ".", aria: "Decimal point" }, { k: "0" }, { k: "00", aria: "Double zero" }],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3.5 px-4 pt-4 pb-6 md:px-7 md:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-8">
      <div className="flex flex-col gap-3.5 lg:col-start-1">
        <PageHeader eyebrow={tripName} title="Currency" action={<Chip tone="premium">Atlas Premium Pass</Chip>} />
        {!online && <p role="status" className="flex items-center gap-2 rounded-lg bg-tint px-3.5 py-2.5 text-[13px] font-semibold text-on-tint"><WifiOff size={16} aria-hidden="true" />Offline: using the last rates saved on this device.</p>}

        <Card className="flex flex-col gap-1 p-4">
          <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wide text-muted"><span>{base} · {label(base)}</span><span>{currencyName(base)}</span></div>
          <label htmlFor={amountId} className="sr-only">Amount in {currencyName(base)}</label>
          <div className="flex items-baseline gap-1">
            <span aria-hidden="true" className="text-[28px] font-extrabold text-muted">{currencySymbol(base)}</span>
            <input id={amountId} inputMode="decimal" value={display} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ""); setDisplay(v === "" ? "0" : v); }} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent text-[40px] leading-none font-extrabold tracking-[-0.02em] text-ink outline-none" />
          </div>
          {adjust && <p className="text-[12.5px] font-semibold text-primary">{adjust.kind === "tip" ? `+ ${adjust.pct}% tip` : `− ${adjust.pct}% off`} = {formatMoney(adjusted, base)} <button type="button" onClick={() => setAdjust(null)} className="ml-1 inline-flex h-6 items-center gap-1 rounded-full bg-tint px-2 text-[11px] font-bold text-on-tint" aria-label="Remove adjustment"><X size={12} aria-hidden="true" />clear</button></p>}
        </Card>

        <div className="-my-5 z-[1] flex justify-center">
          <motion.button type="button" onClick={swap} aria-label="Swap currencies" whileTap={reduce ? undefined : { scale: 0.94, rotate: 180 }} className="inline-flex h-12 w-12 items-center justify-center rounded-full border-4 border-canvas bg-button-ink text-on-button-ink shadow-card"><ArrowDownUp size={20} aria-hidden="true" /></motion.button>
        </div>

        <Card className="flex flex-col gap-1 bg-tint p-4 text-on-tint" aria-live="polite" aria-atomic="true">
          <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wide"><span>{quote} · {label(quote)}</span><span>{currencyName(quote)}</span></div>
          <motion.p key={`${converted}-${quote}`} initial={reduce ? false : { y: 6 }} animate={{ y: 0 }} transition={{ duration: 0.18 }} className="text-[40px] leading-none font-extrabold tracking-[-0.02em]">
            {converted != null ? formatMoney(converted, quote) : rateError ? "—" : "…"}
          </motion.p>
          {rate ? (
            <p className="text-[12.5px] font-semibold">{formatRate(rate)} · mid-market</p>
          ) : rateError ? (
            <p role="alert" className="text-[12.5px] font-semibold text-danger">{rateError}</p>
          ) : null}
          {rate && <p className="text-[12px] opacity-80">{updatedLabel(rate.asOf, now)}{rate.stale ? " · cached, may be out of date" : ""}</p>}
        </Card>

        <div role="group" aria-label="Quick amounts" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {quickAmounts(base).map((a) => (
            <Button key={a} variant="secondary" size="sm" aria-pressed={amount === a && !adjust} onClick={() => { setDisplay(String(a)); setAdjust(null); }}>{formatMoney(a, base)}</Button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Trip currencies" className="flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const on = quote === c.code;
            return (
              <span key={c.code} className="inline-flex items-center">
                <button type="button" role="radio" aria-checked={on} onClick={() => pickQuote(c.code)} className={cx("inline-flex h-10 items-center rounded-full border px-3.5 text-[13px] font-bold transition-colors duration-(--dur-fast)", on ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-tint")}>{c.primary ? c.code : c.label}</button>
                {!c.primary && <button type="button" aria-label={`Remove ${c.code}`} onClick={() => removeCurrency(c.code)} className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-tint hover:text-ink"><Trash2 size={14} aria-hidden="true" /></button>}
              </span>
            );
          })}
          <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => setAddOpen(true)} aria-haspopup="dialog">Add currency</Button>
        </div>

        <div role="group" aria-label="Keypad" className="grid grid-cols-4 gap-2">
          {keys.map((row, i) => (
            <div key={i} className="contents">
              {row.map((c) => <KeypadButton key={c.k} label={c.label ?? c.k} aria={c.aria} onClick={() => press(c.k)} />)}
              {i === 0 && <KeypadButton label="Tip" tone="accent" pressed={picker === "tip"} onClick={() => setPicker((p) => (p === "tip" ? null : "tip"))} aria="Add a tip" />}
              {i === 1 && <KeypadButton label="%" tone="accent" pressed={picker === "off"} onClick={() => setPicker((p) => (p === "off" ? null : "off"))} aria="Take a percentage off (tax-free, discounts)" />}
              {i === 2 && <KeypadButton label={<Delete size={20} aria-hidden="true" />} tone="accent" aria="Backspace" onClick={() => press("backspace")} onLongPress={() => press("clear")} />}
              {i === 3 && <KeypadButton label={<><Bookmark size={16} aria-hidden="true" />Save</>} tone="primary" aria="Save this amount" onClick={save} />}
            </div>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {picker && (
            <motion.div key={picker} role="group" aria-label={picker === "tip" ? "Tip presets" : "Percent off presets"} initial={reduce ? false : { y: -4 }} animate={{ y: 0 }} transition={{ duration: 0.15 }} className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-bold text-muted">{picker === "tip" ? "Tip" : "Off"}</span>
              {(picker === "tip" ? TIP_PRESETS : [8, 10, 15, 20]).map((p) => (
                <Button key={p} variant="secondary" size="sm" icon={<Percent size={14} />} aria-pressed={adjust?.kind === picker && adjust.pct === p} onClick={() => { setAdjust({ kind: picker, pct: p }); setPicker(null); }}>{p}%</Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setAdjust(null); setPicker(null); }}>None</Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>
        <div className="lg:hidden"><CommonPrices country={country} currency={localCurrency} home={homeCurrency} rate={commonRate} items={common} /></div>
        <div className="lg:hidden"><SavedAmounts list={saved} onRemove={(id) => persistSaved(saved.filter((s) => s.id !== id))} /></div>
        <p className="text-[12px] leading-snug text-muted">Rates are mid-market and cached for offline use. Your card or the ATM will apply its own rate and fees.</p>
      </div>

      <aside className="hidden flex-col gap-3.5 lg:col-start-2 lg:sticky lg:top-7 lg:flex" aria-label="Trip currency details">
        <SectionHeader title="Trip currencies" />
        <Card className="divide-y divide-line">
          {chips.map((c) => <CurrencyRow key={c.code} code={c.code} label={c.label} home={homeCurrency} rateAction={rateAction} active={quote === c.code} onPick={() => pickQuote(c.code)} />)}
          <button type="button" onClick={() => setAddOpen(true)} aria-haspopup="dialog" className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] font-semibold text-primary hover:bg-tint/60"><Plus size={18} aria-hidden="true" />Add currency</button>
        </Card>
        <CommonPrices country={country} currency={localCurrency} home={homeCurrency} rate={commonRate} items={common} />
        <SavedAmounts list={saved} onRemove={(id) => persistSaved(saved.filter((s) => s.id !== id))} />
      </aside>

      <dialog ref={addRef} onClose={() => setAddOpen(false)} aria-labelledby="add-currency-title" className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
        <form action={addCurrency} className="flex flex-col gap-3 p-4">
          <h2 id="add-currency-title" className="text-[18px] font-extrabold">Add a currency</h2>
          <p className="text-[13px] text-muted">For a layover or a second country on this trip. Everyone on the trip sees it.</p>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Currency
            <select name="code" required className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-bold outline-none focus:border-primary">
              {ADD_OPTIONS.filter((c) => c !== homeCurrency && c !== localCurrency).map((c) => <option key={c} value={c}>{c} · {currencyName(c)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Note (optional)
            <input name="label" maxLength={60} placeholder="Seoul layover" className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none placeholder:text-faint focus:border-primary" />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" full onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" full loading={pending}>Add</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function KeypadButton({ label, aria, tone = "plain", pressed, onClick, onLongPress }: { label: React.ReactNode; aria?: string; tone?: "plain" | "accent" | "primary"; pressed?: boolean; onClick: () => void; onLongPress?: () => void }) {
  const reduce = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  return (
    <motion.button
      type="button"
      aria-label={aria}
      aria-pressed={pressed}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      onPointerDown={() => { if (!onLongPress) return; fired.current = false; timer.current = setTimeout(() => { fired.current = true; onLongPress(); }, 600); }}
      onPointerUp={() => { if (timer.current) clearTimeout(timer.current); }}
      onPointerLeave={() => { if (timer.current) clearTimeout(timer.current); }}
      onClick={() => { if (fired.current) { fired.current = false; return; } onClick(); }}
      className={cx(
        "inline-flex h-14 items-center justify-center gap-1.5 rounded-xl text-[20px] font-extrabold transition-colors duration-(--dur-fast)",
        tone === "plain" && "bg-surface text-ink border border-line hover:bg-tint",
        tone === "accent" && "bg-tint text-on-tint text-[15px] hover:bg-primary-soft",
        tone === "primary" && "bg-primary text-on-primary text-[15px] hover:bg-primary-hover",
        pressed && "ring-2 ring-primary",
      )}
    >
      {label}
    </motion.button>
  );
}

function CurrencyRow({ code, label, home, rateAction, active, onPick }: { code: string; label: string; home: string; rateAction: ConverterProps["rateAction"]; active: boolean; onPick: () => void }) {
  const [rate, setRate] = useState<CachedRate | null>(null);
  useEffect(() => {
    let alive = true;
    rateAction(home, code).then((r) => { if (alive && !("error" in r)) setRate(r); });
    return () => { alive = false; };
  }, [home, code, rateAction]);
  return (
    <button type="button" onClick={onPick} aria-pressed={active} className={cx("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-(--dur-fast)", active ? "bg-tint" : "hover:bg-tint/60")}>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{code}</span><span className="block truncate text-[12px] text-muted">{label}</span></span>
      <span className="text-[13px] font-bold">{rate ? rate.rate.toLocaleString("en-US", { maximumFractionDigits: rate.rate >= 100 ? 2 : 4 }) : "…"}</span>
    </button>
  );
}

function CommonPrices({ country, currency, home, rate, items }: { country: string | null; currency: string | null; home: string; rate: number | null; items: { label: string; amount: number }[] }) {
  if (!currency || !items.length) return null;
  return (
    <section aria-labelledby="common-title" className="flex flex-col gap-2">
      <SectionHeader id="common-title" title={`Common in ${country ?? "the trip"}`} />
      <Card className="divide-y divide-line">
        {items.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14px]">
            <span className="font-semibold">{p.label}</span>
            <span className="text-right"><span className="font-bold">{formatMoney(p.amount, currency)}</span>{rate != null && currency !== home && <span className="text-muted"> ≈ {formatMoney(convert(p.amount, rate, home), home)}</span>}</span>
          </div>
        ))}
      </Card>
    </section>
  );
}

function SavedAmounts({ list, onRemove }: { list: SavedAmount[]; onRemove: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <section aria-labelledby="saved-amounts-title" className="flex flex-col gap-2">
      <SectionHeader id="saved-amounts-title" title="Saved on this device" />
      <Card className="divide-y divide-line">
        {list.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14px]">
            <span><span className="font-bold">{formatMoney(s.amount, s.base)}</span> <span className="text-muted">= {formatMoney(s.converted, s.quote)}</span></span>
            <button type="button" aria-label={`Remove saved ${formatMoney(s.amount, s.base)}`} onClick={() => onRemove(s.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-tint hover:text-ink"><Trash2 size={14} aria-hidden="true" /></button>
          </div>
        ))}
      </Card>
    </section>
  );
}
