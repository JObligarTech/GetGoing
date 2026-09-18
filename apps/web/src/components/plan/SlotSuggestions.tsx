"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Place } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Dot, Tile } from "@/components/ui/primitives";

export interface Suggestion { place: Place; fromName: string; minutes: number; color: string; category: string }

/**
 * The dashed "open slot" row. Tapping it opens a dialog listing nearby unscheduled
 * places; choosing one submits assignPlaceToSlot. Native <dialog> gives us focus
 * trapping and Esc for free.
 */
export function OpenSlot({ time, title, suggestions, tripId, itemId, day, action }: {
  time: string; title: string; suggestions: Suggestion[]; tripId: string; itemId: string; day: string; action: (fd: FormData) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("button, [href], input")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="m-1 flex w-[calc(100%-8px)] items-center gap-3 rounded-md border-[1.5px] border-dashed border-line-strong px-2.5 py-2.5 text-left text-muted transition-colors hover:bg-tint/60"
      >
        <span className="w-11 shrink-0 text-[12.5px] font-bold">{time}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block text-[12px]">Open slot · {suggestions.length} saved nearby</span>
        </span>
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-md bg-tint text-primary"><Plus size={18} /></span>
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-labelledby={id} className="m-auto w-[min(92vw,440px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
        <div className="flex flex-col gap-3 p-4">
          <h2 id={id} className="text-[18px] font-extrabold">Fill the {time} slot</h2>
          <p className="text-[13px] text-muted">Saved places near your previous stop.</p>
          {suggestions.length ? (
            <form action={action} className="card divide-y divide-line">
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="itemId" value={itemId} />
              <input type="hidden" name="day" value={day} />
              {suggestions.map((s) => (
                <button key={s.place.id} type="submit" name="placeId" value={s.place.id} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-tint/60">
                  <Tile name={s.place.name} size={40} radius={10} color={s.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{s.place.name}</span>
                    <span className="block text-[12px] text-muted"><Dot color={s.color} size={8} className="mr-1.5 align-middle" />{s.category} · {s.minutes} min from {s.fromName}</span>
                  </span>
                  <span className="text-[13px] font-bold text-primary">Add</span>
                </button>
              ))}
            </form>
          ) : (
            <p className="card px-3.5 py-4 text-[13px] text-muted">Every saved place is already on a day. Save more in the Map view.</p>
          )}
          <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </dialog>
    </>
  );
}
