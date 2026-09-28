"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, currencyName } from "@voya/core";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CAD", "AUD", "SGD", "PHP", "MXN", "CHF", "INR", "THB", "VND"];
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Form";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ListRow } from "@/components/ui/primitives";

export interface Defaults { homeCurrency: string; homeTz: string; languages: string[]; units: "km" | "mi" }

const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();
const tzCity = (tz: string) => tz.split("/").pop()?.replace(/_/g, " ") ?? tz;

/** Defaults rows (mockup 6a) with an edit dialog; units flip inline. Every tool reads these. */
export function ProfileDefaults({ initial, action }: { initial: Defaults; action: (input: unknown) => Promise<{ ok: true } | { error: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); d.querySelector<HTMLElement>("input, select")?.focus(); }
    if (!open && d.open) d.close();
  }, [open]);

  const save = (next: Defaults, close = true) => start(async () => {
    const r = await action(next);
    if ("error" in r) { setError(r.error); return; }
    setError(null); setDraft(next); setStatus("Defaults saved."); if (close) setOpen(false);
    router.refresh();
  });

  return (
    <>
      <ListRow title="Home currency" trailing={<span className="text-[13px] font-bold text-muted">{draft.homeCurrency}</span>} onClick={() => setOpen(true)} ariaLabel={`Home currency ${draft.homeCurrency}, edit`} chevron />
      <ListRow title="Home time zone" trailing={<span className="text-[13px] font-bold text-muted">{tzCity(draft.homeTz)}</span>} onClick={() => setOpen(true)} ariaLabel={`Home time zone ${draft.homeTz}, edit`} chevron />
      <ListRow title="I speak" trailing={<span className="max-w-[50%] truncate text-[13px] font-bold text-muted">{draft.languages.map(langName).join(", ")}</span>} onClick={() => setOpen(true)} ariaLabel={`I speak ${draft.languages.map(langName).join(", ")}, edit`} chevron />
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <span className="text-[15px] font-semibold">Units</span>
        <SegmentedControl label="Units" size="sm" value={draft.units} options={[{ value: "km", label: "km", ariaLabel: "Kilometres" }, { value: "mi", label: "mi", ariaLabel: "Miles" }]} onChange={(units) => save({ ...draft, units }, false)} />
      </div>
      <p role="status" className={status ? "px-3.5 pb-2 text-[12px] font-semibold text-primary" : "sr-only"}>{status}</p>

      <dialog ref={ref} aria-labelledby="defaults-title" onClose={() => setOpen(false)} className="m-auto w-[min(92vw,440px)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-card backdrop:bg-black/40">
        <form onSubmit={(e) => { e.preventDefault(); save(draft); }} className="flex flex-col gap-3.5">
          <h2 id="defaults-title" className="text-[20px] font-extrabold tracking-[-0.02em]">Trip defaults</h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="def-currency" className="text-[13px] font-semibold">Home currency</label>
            <select id="def-currency" value={draft.homeCurrency} onChange={(e) => setDraft({ ...draft, homeCurrency: e.target.value })} className="h-12 rounded-lg border border-line-strong bg-surface px-3 text-[15px]">
              {[draft.homeCurrency, ...CURRENCIES].filter((c, i, a) => a.indexOf(c) === i).map((c) => <option key={c} value={c}>{c} · {currencyName(c)}</option>)}
            </select>
          </div>
          <Field label="Home time zone" hint="An IANA name, like America/New_York" value={draft.homeTz} onChange={(e) => setDraft({ ...draft, homeTz: e.target.value })} required />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[13px] font-semibold">I speak</legend>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.slice(0, 14).map((l) => {
                const on = draft.languages.includes(l.code);
                return <button key={l.code} type="button" role="checkbox" aria-checked={on} onClick={() => setDraft({ ...draft, languages: on ? draft.languages.filter((c) => c !== l.code) : [...draft.languages, l.code] })} className={on ? "h-9 rounded-full bg-primary px-3 text-[12.5px] font-bold text-on-primary" : "h-9 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] font-bold text-ink hover:bg-tint"}>{l.name}</button>;
              })}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-[12.5px] font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setDraft(initial); setOpen(false); }}>Cancel</Button>
            <Button type="submit" loading={pending} disabled={draft.languages.length === 0}>Save</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
