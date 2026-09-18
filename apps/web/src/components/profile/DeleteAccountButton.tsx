"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/** Two-step destructive action in an accessible modal dialog (native <dialog>, focus-trapped, Esc closes). */
export function DeleteAccountButton({ action }: { action: () => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("button")?.focus(); // "Keep my account" — the safe choice first
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Delete my account</Button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-labelledby={titleId} className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-card backdrop:bg-black/50">
        <h2 id={titleId} className="text-[18px] font-extrabold">Delete your account?</h2>
        <p className="mt-2 text-[13.5px] text-muted">All trips, places and settings are removed immediately. Trips you share are handed to another editor. This cannot be undone.</p>
        <form action={action} className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} autoFocus>Keep my account</Button>
          <Button type="submit" variant="danger">Delete everything</Button>
        </form>
      </dialog>
    </>
  );
}
