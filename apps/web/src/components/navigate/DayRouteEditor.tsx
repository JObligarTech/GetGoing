"use client";
import { useActionState, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Home as HomeIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { moveItem, MODE_LABEL, type TravelMode } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Form";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card, Dot, Tile } from "@/components/ui/primitives";
import type { ActionState } from "@/app/auth/actions";

export interface DayRow { id: string; name: string; isHotel: boolean; color: string; arrive: string | null; leave: string | null; legSummary: string | null }

/**
 * Stops list with keyboard-accessible reordering (move up/down buttons — each row
 * announces its new position), the walk/transit toggle, and "Save route".
 * Reordering is reflected in the URL (?order=) so the server re-routes; the list
 * animates with a layout transition, disabled under reduced motion.
 */
export function DayRouteEditor({ tripId, day, mode, locked, rows, saveAction, defaultName }: {
  tripId: string; day: string; mode: TravelMode; locked: boolean; rows: DayRow[]; saveAction: (prev: ActionState, fd: FormData) => Promise<ActionState>; defaultName: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [state, action, pending] = useActionState(saveAction, {} as ActionState);
  const [announce, setAnnounce] = useState("");
  const middle = rows.slice(1, -1);

  const push = (order: DayRow[], m = mode) => router.push(`/navigate/day?day=${day}&mode=${m}&order=${order.map((r) => r.id).join(",")}` as Route);
  const move = (i: number, delta: number) => {
    const next = moveItem(middle, i, i + delta);
    if (next === middle) return;
    setAnnounce(`${middle[i]!.name} moved to stop ${i + delta + 1} of ${middle.length}`);
    push(next);
  };

  return (
    <>
      {!locked && (
        <SegmentedControl label="Travel mode" size="sm" value={mode} onChange={(m) => push(middle, m)} options={[{ value: "walk", label: MODE_LABEL.walk }, { value: "transit", label: MODE_LABEL.transit }]} />
      )}
      <span role="status" aria-live="polite" className="sr-only">{announce}</span>
      <LayoutGroup>
        <Card role="list" aria-label="Stops in order" className="divide-y divide-line">
          {rows.map((r, idx) => {
            const i = idx - 1; // index within the reorderable middle
            const canMove = !locked && !r.isHotel;
            return (
              <motion.div role="listitem" key={`${r.id}-${idx}`} layout={reduce ? false : "position"} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} className="flex items-center gap-3 px-3.5 py-3">
                {r.isHotel ? (
                  <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-tint text-on-tint"><HomeIcon size={18} /></span>
                ) : (
                  <span aria-hidden="true" className="relative"><Tile name={String(i + 1)} size={36} radius={10} color={r.color} /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{r.isHotel ? (idx === 0 ? r.name : "Back to hotel") : r.name}</span>
                  <span className="block text-[12px] text-muted">
                    {idx === 0 ? `Leave ${r.leave}` : `Arrive ${r.arrive}${r.legSummary ? ` · ${r.legSummary}` : ""}`}
                  </span>
                </span>
                {!r.isHotel && <Dot color={r.color} size={8} />}
                {canMove && (
                  <span className="flex flex-col">
                    <button type="button" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-6 w-8 items-center justify-center rounded-sm text-muted hover:bg-tint disabled:opacity-30"><ChevronUp size={16} /></button>
                    <button type="button" aria-label={`Move ${r.name} down`} disabled={i === middle.length - 1} onClick={() => move(i, 1)} className="flex h-6 w-8 items-center justify-center rounded-sm text-muted hover:bg-tint disabled:opacity-30"><ChevronDown size={16} /></button>
                  </span>
                )}
              </motion.div>
            );
          })}
        </Card>
      </LayoutGroup>

      {!locked && (
        <form action={action} className="card flex flex-col gap-3 p-3.5">
          <FormError>{state.error}</FormError>
          {state.ok && <p role="status" className="text-[13px] font-semibold text-primary">{state.message}</p>}
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="stops" value={rows.map((r) => `${r.id}@${r.arrive ?? r.leave ?? ""}`).join(",")} />
          {/* Validated server-side so the error is a real, announced alert rather than a browser tooltip. */}
          <Field label="Route name" name="name" defaultValue={state.values?.name ?? defaultName} maxLength={120} error={state.fieldErrors?.name} />
          <div className="flex gap-2">
            <Button type="submit" size="cta" full loading={pending}>Save route</Button>
            <Button href={`/navigate/route?to=${middle[0]?.id ?? ""}&mode=${mode}`} variant="ink" size="cta" full>Start</Button>
          </div>
        </form>
      )}
    </>
  );
}
