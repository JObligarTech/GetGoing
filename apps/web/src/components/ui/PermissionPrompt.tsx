"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { PERMISSION_COPY, type Capability } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { permStore } from "@/lib/offline";

export type { Capability };
/** True when this device hasn't seen the sheet for the capability yet. */
export function needsPrompt(cap: Capability): boolean {
  return !permStore.get()[cap];
}

/** Modal explanation shown before the browser's own permission prompt. Focus lands on the primary action; Escape declines. */
export function PermissionPrompt({ cap, context, onAllow, onDecline, extra }: { cap: Capability; context?: string; onAllow: () => void; onDecline: () => void; extra?: ReactNode }) {
  const copy = PERMISSION_COPY[cap];
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e: Event) => { e.preventDefault(); onDecline(); };
    d?.addEventListener("cancel", onCancel);
    return () => d?.removeEventListener("cancel", onCancel);
  }, [onDecline]);
  const decide = (allowed: boolean) => {
    permStore.set({ ...permStore.get(), [cap]: allowed ? "asked" : "declined" });
    (allowed ? onAllow : onDecline)();
  };
  return (
    <dialog ref={ref} aria-labelledby={`perm-${cap}-title`} className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-card backdrop:bg-black/40">
      <h2 id={`perm-${cap}-title`} className="text-[20px] leading-tight font-extrabold tracking-[-0.02em]">{copy.title}</h2>
      <p className="mt-2 text-[14px] text-muted">{copy.lead(context)}</p>
      <ul className="mt-3 flex flex-col gap-2 text-[13px]">
        {copy.points.map((p) => <li key={p} className="flex gap-2"><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{p}</li>)}
      </ul>
      {extra}
      <div className="mt-4 flex flex-col gap-2">
        <Button size="cta" full onClick={() => decide(true)} autoFocus>{copy.allow}</Button>
        <Button variant="ghost" full onClick={() => decide(false)}>{copy.decline}</Button>
      </div>
      <p className="mt-3 text-center text-[11.5px] text-muted">{copy.after("your browser")} See our <Link href="/legal/privacy" className="font-bold text-primary">Privacy Policy</Link>.</p>
    </dialog>
  );
}
