"use client";
import type { Route } from "next";
import { Footprints, Car, Lightbulb, Play } from "lucide-react";
import { formatClock, formatDistance, formatDuration, formatMoney, type RouteTree, type TreePlan, type TreeStop } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { ShareEta } from "@/components/navigate/ShareEta";
import { Avatars } from "./Avatars";
import type { TreePlace, TreeTraveler } from "./types";

/** Route comparison: one card per branch, the insight line, and one-tap alternatives. */
export function CompareView({ tree, plan, places, travelers, currency, meet, onApplyAlternative }: {
  tree: RouteTree; plan: TreePlan | null; places: Map<string, TreePlace>; travelers: TreeTraveler[]; currency: string; meet: TreeStop | null;
  onApplyAlternative: (branchId: string, legIndex: number, mode: "walk" | "drive") => void;
}) {
  if (!plan || plan.lanes.length === 0) return <p className="card px-3.5 py-4 text-[13px] text-muted">Add a branch to compare the groups.</p>;
  const meetName = meet ? places.get(meet.placeId)?.name.split(" ")[0] ?? "the meeting point" : "the end";
  const shareText = plan.lanes.map((l) => `${l.branch.name}: ${formatDuration(l.doorToDoorSec)} door to ${meetName}, ${formatDuration(l.travelSec)} travel, at ${meetName} ${l.arrive ? formatClock(l.arrive) : "—"}`).join(". ") + (plan.insight ? `. ${plan.insight}` : "");
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3 md:grid-cols-2">
        {plan.lanes.map((l) => {
          const people = travelers.filter((t) => l.branch.travelerIds.includes(t.id));
          const firstStop = tree.stops.filter((s) => s.branchId === l.branch.id).sort((a, b) => a.sortOrder - b.sortOrder)[0];
          return (
            <section key={l.branch.id} aria-labelledby={`cmp-${l.branch.id}`} className="card flex flex-col gap-3 p-3.5" style={{ borderTop: `3px solid ${l.branch.color}` }}>
              <div className="flex items-center justify-between">
                <h2 id={`cmp-${l.branch.id}`} className="text-eyebrow flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: l.branch.color }} />{l.branch.name}</h2>
                <Avatars travelers={people} />
              </div>
              <p><span className="text-[26px] font-extrabold tracking-[-0.02em]">{formatDuration(l.doorToDoorSec)}</span><span className="ml-2 text-[12.5px] text-muted">Door to {meetName}</span></p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                <dt className="text-muted">Travel</dt><dd className="font-bold">{formatDuration(l.travelSec)}</dd>
                <dt className="text-muted">Walking</dt><dd className="font-bold">{formatDistance(l.walkM)}</dd>
                <dt className="text-muted">Fares</dt><dd className="font-bold">{l.fares ? `${formatMoney(l.fares.amount, l.fares.currency)} pp` : formatMoney(0, currency)}</dd>
                <dt className="text-muted">Transfers</dt><dd className="font-bold">{l.transfers}</dd>
                <dt className="text-muted">At {meetName}</dt><dd className="font-bold">{l.arrive ? formatClock(l.arrive) : "—"}</dd>
              </dl>
              <p className="text-[12px] text-muted">{l.chain}</p>
              {firstStop && <Button href={`/navigate/route?to=${firstStop.placeId}&mode=${firstStop.mode ?? tree.mode}` as Route} variant="ink" size="sm" icon={<Play size={14} />}>Start {l.branch.name}</Button>}
            </section>
          );
        })}
      </div>

      {plan.insight && (
        <p role="note" className="flex items-start gap-2.5 rounded-lg bg-tint px-3.5 py-3 text-[13px] leading-snug text-on-tint">
          <Lightbulb aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>{plan.insight}</span>
        </p>
      )}
      {plan.unassignedTravelerIds.length > 0 && (
        <p role="note" className="text-[13px] text-muted">Not on a branch yet: {travelers.filter((t) => plan.unassignedTravelerIds.includes(t.id)).map((t) => t.name.split(" ")[0]).join(", ")}. Open a branch stop to assign them.</p>
      )}

      {plan.lanes.filter((l) => l.alternatives.length).map((l) => (
        <section key={l.branch.id} aria-label={`Alternatives for ${l.branch.name}`} className="flex flex-col gap-2">
          <h2 className="text-eyebrow">Alternatives for {l.branch.name}</h2>
          <ul className="card divide-y divide-line">
            {l.alternatives.map((a) => (
              <li key={a.mode}>
                <button type="button" onClick={() => onApplyAlternative(l.branch.id, a.legIndex, a.mode as "walk" | "drive")} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-tint/60">
                  <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-tint text-on-tint">{a.mode === "walk" ? <Footprints size={18} /> : <Car size={18} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">{a.label}</span>
                    <span className="block text-[12px] text-muted">{a.deltaSec >= 0 ? "+" : "−"}{formatDuration(Math.abs(a.deltaSec))}{a.fare ? ` · ${formatMoney(a.fare.amount, a.fare.currency)}` : a.mode === "walk" ? ` · ${formatMoney(0, currency)}` : ""}</span>
                  </span>
                  <span className="text-[13px] font-bold text-primary">Use</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="flex gap-2">
        <ShareEta text={`${tree.name}: ${shareText}`} label="Share comparison" />
      </div>
    </div>
  );
}
