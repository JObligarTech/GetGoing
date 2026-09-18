"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dot, Tile } from "@/components/ui/primitives";
import type { TreePlace } from "./types";

/** Modal list of the trip's saved places with a filter box; choosing one calls onPick. */
export function PlacePicker({ open, title, places, onPick, onClose }: { open: boolean; title: string; places: TreePlace[]; onPick: (placeId: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [q, setQ] = useState("");
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setQ(""); d.showModal(); d.querySelector<HTMLElement>("input")?.focus(); }
    if (!open && d.open) d.close();
  }, [open]);
  const list = places.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={id} className="m-auto w-[min(92vw,440px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
      <div className="flex flex-col gap-3 p-4">
        <h2 id={id} className="text-[18px] font-extrabold">{title}</h2>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Search saved places
          <input value={q} onChange={(e) => setQ(e.target.value)} className="h-11 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] font-normal outline-none focus:border-primary" placeholder="Shibuya…" />
        </label>
        <ul className="card max-h-[50vh] divide-y divide-line overflow-y-auto" aria-label="Saved places">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-tint/60">
                <Tile name={p.name} size={40} radius={10} color={p.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{p.name}</span>
                  <span className="block text-[12px] text-muted"><Dot color={p.color} size={8} className="mr-1.5 align-middle" />{p.isHotel ? "Your stay" : p.category}</span>
                </span>
                <span className="text-[13px] font-bold text-primary">Add</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3.5 py-4 text-[13px] text-muted">No saved place matches.</li>}
        </ul>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </dialog>
  );
}
