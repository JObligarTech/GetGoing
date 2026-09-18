"use client";
import { useEffect, useState } from "react";
import { Bike, Car, ChevronDown, ChevronUp, Footprints, TrainFront, Trash2 } from "lucide-react";
import { formatClock, formatDuration, MODE_LABEL, TRAVEL_MODES, type RouteTree, type TravelMode, type TreePlan, type TreeStop } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";
import { Avatars } from "./Avatars";
import type { TreeEditorProps, TreePlace, TreeTraveler } from "./types";

const ICON: Record<TravelMode, typeof Footprints> = { walk: Footprints, transit: TrainFront, drive: Car, cycle: Bike };

export interface SegmentPanelProps {
  tree: RouteTree;
  plan: TreePlan | null;
  stop: TreeStop;
  /** The stop this segment starts from (previous in lane, or the split stop). */
  from: TreeStop | null;
  places: Map<string, TreePlace>;
  travelers: TreeTraveler[];
  tripId: string;
  legModesAction: TreeEditorProps["legModesAction"];
  onToggleTraveler: (branchId: string, travelerId: string, on: boolean) => void;
  onMode: (mode: TravelMode | null, forBranchId?: string) => void;
  onPatch: (patch: { plannedTime?: string | null; dwellMin?: number | null }) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onDone: () => void;
  canMove: { up: boolean; down: boolean };
}

/**
 * "Segment sheet": who's on this branch, mode for the segment (with durations), planned time,
 * time at the stop, move/remove. Rendered inside a dialog on phones and inline on desktop.
 */
export function SegmentPanel({ tree, plan, stop, from, places, travelers, tripId, legModesAction, onToggleTraveler, onMode, onPatch, onMove, onRemove, onDone, canMove }: SegmentPanelProps) {
  const place = places.get(stop.placeId)!;
  const branch = tree.branches.find((b) => b.id === stop.branchId) ?? null;
  const siblings = branch ? tree.branches.filter((b) => b.splitAfterStopId === branch.splitAfterStopId && b.id !== branch.id) : [];
  const mergingLanes = !branch ? tree.branches.filter((b) => { const t = tree.stops.filter((s) => s.branchId === null).sort((a, c) => a.sortOrder - c.sortOrder); const i = t.findIndex((s) => s.id === stop.id); return i > 0 && b.splitAfterStopId === t[i - 1]!.id; }) : [];
  const times = plan?.times[stop.id];
  // Durations per mode are keyed by the segment so a stale answer for another segment is ignored.
  const segKey = from ? `${from.placeId}>${stop.placeId}` : null;
  const [loaded, setLoaded] = useState<{ key: string; durations: Partial<Record<TravelMode, number>> } | null>(null);
  useEffect(() => {
    if (!segKey || !from) return;
    let alive = true;
    legModesAction(tripId, from.placeId, stop.placeId).then((r) => { if (alive && !("error" in r)) setLoaded({ key: segKey, durations: r }); });
    return () => { alive = false; };
  }, [segKey, from, stop.placeId, tripId, legModesAction]);
  const durations = loaded?.key === segKey ? loaded.durations : {};
  const isFirst = !from;
  const title = from ? `${places.get(from.placeId)?.name ?? "Start"} → ${place.name}` : place.name;

  const modePicker = (current: TravelMode | null, label: string, pick: (m: TravelMode | null) => void, name: string) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-eyebrow mb-1">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {TRAVEL_MODES.map((m) => {
          const Icon = ICON[m];
          const on = (current ?? tree.mode) === m;
          const sec = durations[m];
          return (
            <label key={m} className={cx("flex h-10 cursor-pointer items-center gap-1.5 rounded-pill px-3 text-[13px] font-bold has-focus-visible:outline-2 has-focus-visible:outline-primary", on ? "bg-primary text-on-primary" : "bg-tint text-on-tint")}>
              <input type="radio" name={name} value={m} checked={on} onChange={() => pick(m)} className="sr-only" />
              <Icon aria-hidden="true" size={16} />
              <span>{MODE_LABEL[m]}{sec != null ? ` · ${formatDuration(sec)}` : ""}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[12.5px] font-medium text-muted">Segment · {branch ? `${branch.name} branch` : "Everyone"}</p>
        <h2 className="text-[18px] font-extrabold tracking-[-0.01em]">{title}</h2>
        {times && <p className="mt-1 text-[13px] text-muted">{times.arrive ? `Arrives ${formatClock(times.arrive)}` : "Start"} · leaves {formatClock(times.leave)}</p>}
      </div>

      {branch && (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-eyebrow mb-2">Who&apos;s on this branch</legend>
          {travelers.map((t) => {
            const on = branch.travelerIds.includes(t.id);
            const elsewhere = siblings.find((b) => b.travelerIds.includes(t.id));
            return (
              <label key={t.id} className="flex h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-tint/60">
                <input type="checkbox" checked={on} onChange={(e) => onToggleTraveler(branch.id, t.id, e.target.checked)} className="h-5 w-5 accent-[#2F5D3A]" />
                <Avatars travelers={[t]} />
                <span className="text-[14px] font-semibold">{t.name.split(" ")[0]}</span>
                {elsewhere && !on && <Chip tone="plain">· {elsewhere.name.replace("Group ", "")}</Chip>}
              </label>
            );
          })}
        </fieldset>
      )}

      {!isFirst && !mergingLanes.length && modePicker(stop.mode, "Mode for this segment", (m) => onMode(m), `mode-${stop.id}`)}
      {mergingLanes.map((b) => (
        <div key={b.id}>{modePicker(b.mergeMode, `${b.name} arrives by`, (m) => onMode(m, b.id), `merge-${b.id}`)}</div>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {isFirst ? "Depart at" : "Planned time"}
          <input type="time" value={stop.plannedTime ?? ""} onChange={(e) => onPatch({ plannedTime: e.target.value || null })} className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-normal outline-none focus:border-primary" />
        </label>
        {!isFirst && (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Time there (min)
            <input type="number" min={0} max={1440} step={5} value={stop.dwellMin ?? ""} onChange={(e) => onPatch({ dwellMin: e.target.value === "" ? null : Math.max(0, Math.min(1440, Number(e.target.value))) })} className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-normal outline-none focus:border-primary" />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={<ChevronUp size={16} />} onClick={() => onMove(-1)} disabled={!canMove.up}>Move up</Button>
        <Button variant="secondary" size="sm" icon={<ChevronDown size={16} />} onClick={() => onMove(1)} disabled={!canMove.down}>Move down</Button>
        <Button variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={onRemove}>Remove stop</Button>
        <Button size="sm" onClick={onDone} className="ml-auto">Done</Button>
      </div>
    </div>
  );
}
