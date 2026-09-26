"use client";
import { useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { claimShare, convert, formatMoney, type ClaimView } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/utils";

/** "Chris, pick what you ordered" — the whole public page's interactive part. Token-scoped; no account. */
export function ClaimForm({ token, view: initialView, homeRate, submitAction }: { token: string; view: ClaimView; homeRate: { currency: string; rate: number } | null; submitAction: (token: unknown, itemIds: unknown) => Promise<ClaimView | { error: string }> }) {
  const [view, setView] = useState(initialView);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(view.shares.filter((s) => s.participant_id === view.you.id).map((s) => s.item_id)));
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mine = useMemo(() => claimShare(view, chosen), [view, chosen]);
  const money = (n: number) => formatMoney(n, view.currency);
  const closed = view.status !== "open";
  const others = (itemId: string) => view.shares.filter((s) => s.item_id === itemId && s.participant_id !== view.you.id).map((s) => view.participants.find((p) => p.id === s.participant_id)?.name).filter(Boolean) as string[];

  const submit = () => start(async () => {
    const r = await submitAction(token, [...chosen]);
    if ("error" in r) { setError(r.error); return; }
    setView(r); setError(null); setStatus(`Sent. ${view.sender} sees your picks now. Your share so far: ${money(mine.total)}.`);
  });

  return (
    <div className="flex flex-col gap-3.5">
      <ul className="card divide-y divide-line" aria-label="Items on the bill">
        {view.items.map((i) => {
          const on = chosen.has(i.id);
          const o = others(i.id);
          const n = o.length + (on ? 1 : 0);
          const each = n > 1 ? i.qty * i.unit_price / n : null;
          return (
            <li key={i.id}>
              <button type="button" role="checkbox" aria-checked={on} disabled={closed} onClick={() => setChosen((c) => { const next = new Set(c); if (next.has(i.id)) next.delete(i.id); else next.add(i.id); return next; })} className={cx("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors", on ? "bg-tint" : "hover:bg-tint/50", closed && "cursor-default")}>
                <span aria-hidden="true" className={cx("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-on-primary" : "border-line-strong")}>{on && <Check size={16} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{i.name}</span>
                  <span className="block text-[12px] text-muted">{on && o.length ? `You + ${o.join(", ")} · ${money(each!)} each` : on ? "Just you" : o.length ? o.join(", ") : "Nobody yet"}</span>
                </span>
                <span className="text-[14px] font-extrabold">{money(i.qty * i.unit_price)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[12.5px] text-muted">{view.tax_amount > 0 ? `Tax is shared ${view.tax_mode === "even" ? "evenly" : "in proportion"}. ` : ""}{view.sender} sees your picks instantly; you can change them until {view.sender} closes the bill.</p>
      <div className="card flex items-center justify-between p-3.5" aria-live="polite">
        <div><p className="text-[12px] font-bold uppercase tracking-wide text-muted">Your share so far</p><p className="text-[22px] font-extrabold">{money(mine.total)}{homeRate && homeRate.currency !== view.currency && <span className="ml-2 text-[14px] font-semibold text-muted">≈ {formatMoney(convert(mine.total, homeRate.rate, homeRate.currency), homeRate.currency)}</span>}</p></div>
        <Button size="cta" onClick={submit} loading={pending} disabled={closed}>{closed ? "Bill closed" : "Submit"}</Button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</p>}
      <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>
    </div>
  );
}
