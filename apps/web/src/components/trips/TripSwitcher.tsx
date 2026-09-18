"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { TripListItem } from "@voya/core";
import { formatDateRange } from "@voya/core";
import { Tile } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";

/**
 * The trip name in the Home header is a menu button: opens a list of trips,
 * choosing one submits a form to setActiveTrip. Arrow keys move, Esc closes,
 * focus returns to the button.
 */
export function TripSwitcher({ trips, activeId, action, back }: { trips: TripListItem[]; activeId: string; action: (fd: FormData) => Promise<void>; back: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const reduce = useReducedMotion();
  const active = trips.find((t) => t.id === activeId);

  useEffect(() => {
    if (!open) return;
    const first = menu.current?.querySelector<HTMLButtonElement>("button");
    first?.focus();
    const onDoc = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && e.target !== btn.current) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  };

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-full items-center gap-1.5 rounded-md text-left text-[26px] font-extrabold tracking-[-0.02em]"
      >
        <span className="truncate">{active?.name ?? "Pick a trip"}</span>
        <ChevronDown aria-hidden="true" size={18} strokeWidth={2.4} className="shrink-0 text-muted" />
        <span className="sr-only">, switch trip</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            id={id}
            role="menu"
            aria-label="Switch trip"
            onKeyDown={onKey}
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute top-full left-0 z-30 mt-2 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line bg-surface shadow-card"
          >
            <form action={action} className="flex flex-col">
              <input type="hidden" name="back" value={back} />
              {trips.map((t) => (
                <button
                  key={t.id}
                  type="submit"
                  name="tripId"
                  value={t.id}
                  role="menuitemradio"
                  aria-checked={t.id === activeId}
                  className={cx("flex items-center gap-3 px-3.5 py-3 text-left hover:bg-tint/60", t.id === activeId && "bg-tint")}
                >
                  <Tile name={t.name} size={36} radius={10} invert={t.id !== activeId} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{t.name}</span>
                    <span className="block text-[12px] text-muted">{formatDateRange(t.start_date, t.end_date)}</span>
                  </span>
                </button>
              ))}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
