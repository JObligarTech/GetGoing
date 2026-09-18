"use client";
import { useEffect, useState } from "react";
import { Home as HomeIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Dot } from "@/components/ui/primitives";

const PEOPLE = [
  { id: "J", color: "#2F5D3A", lane: "a" },
  { id: "C", color: "#E0703A", lane: "b" },
  { id: "D", color: "#5568C9", lane: "b" },
  { id: "S", color: "#C9516F", lane: "a" },
];
type Phase = "hotel" | "split" | "dinner";
const PHASES: Phase[] = ["hotel", "split", "dinner"];

/**
 * Groups split, then meet again: four travelers leave the hotel together, Group A
 * heads to Shibuya Sky while Group B walks to the Pokémon Center, and everyone is
 * back at Afuri for 7:30 PM. The avatars are the same elements moving between nodes.
 * At rest the split is shown, since that is the point.
 */
export function TreeScene() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("split");
  useEffect(() => {
    if (reduce) return;
    let i = 1;
    const id = setInterval(() => { i = (i + 1) % PHASES.length; setPhase(PHASES[i]!); }, 2400);
    return () => clearInterval(id);
  }, [reduce]);

  const avatars = (where: "hotel" | "a" | "b" | "dinner") => (
    <span className="inline-flex min-h-6 items-center">
      {PEOPLE.filter((p) => (phase === "hotel" && where === "hotel") || (phase === "dinner" && where === "dinner") || (phase === "split" && p.lane === where)).map((p, i) => (
        <motion.span key={p.id} layoutId={`tree-${p.id}`} transition={{ type: "spring", stiffness: 220, damping: 26 }} className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[10px] font-bold text-white" style={{ background: p.color, marginLeft: i ? -7 : 0 }}>{p.id}</motion.span>
      ))}
    </span>
  );

  return (
    <LayoutGroup>
      <div aria-hidden="true" className="card flex flex-col items-center p-4">
        <div className="flex w-full max-w-[260px] items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-button-ink text-on-button-ink"><HomeIcon size={15} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">Hotel Gracery</span><span className="block text-[11.5px] text-muted">Everyone · leave 2:30 PM</span></span>
          {avatars("hotel")}
        </div>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full max-w-[420px]">
          <path d="M50 0 V10 C50 20 25 20 25 30 V40" fill="none" stroke="#2F5D3A" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <path d="M50 0 V10 C50 20 75 20 75 30 V40" fill="none" stroke="#F2B233" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="grid w-full max-w-[420px] grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-2">
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-pill bg-tint px-2.5 text-[11.5px] font-extrabold uppercase text-on-tint" style={{ boxShadow: "inset 0 0 0 1.5px #2F5D3A" }}><Dot color="#2F5D3A" size={8} />Group A</span>
            <div className="w-full rounded-xl border border-line bg-surface px-3 py-2.5"><span className="block text-[14px] font-bold">Shibuya Sky</span><span className="block text-[11.5px] text-muted">Train 18 min · 1 h 30 there</span><span className="mt-1.5 block">{avatars("a")}</span></div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-pill bg-tint px-2.5 text-[11.5px] font-extrabold uppercase text-on-tint" style={{ boxShadow: "inset 0 0 0 1.5px #F2B233" }}><Dot color="#F2B233" size={8} />Group B</span>
            <div className="w-full rounded-xl border border-line bg-surface px-3 py-2.5"><span className="block text-[14px] font-bold">Pokémon Center</span><span className="block text-[11.5px] text-muted">Walk 22 min · 1 h there</span><span className="mt-1.5 block">{avatars("b")}</span></div>
          </div>
        </div>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full max-w-[420px]">
          <path d="M25 0 V10 C25 20 50 20 50 30 V40" fill="none" stroke="#2F5D3A" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <path d="M75 0 V10 C75 20 50 20 50 30 V40" fill="none" stroke="#F2B233" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex w-full max-w-[260px] items-center gap-3 rounded-xl bg-button-ink px-3 py-2.5 text-on-button-ink">
          <Dot color="#E0703A" size={10} />
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">Afuri Ramen · Dinner</span><span className="block text-[11.5px] opacity-80">Everyone meets · 7:30 PM</span></span>
          {avatars("dinner")}
        </div>
      </div>
      <p className="sr-only">A tree route: everyone leaves Hotel Gracery at 2:30 PM. Group A, Joe and Sarah, take the train to Shibuya Sky. Group B, Chris and Daniel, walk to the Pokémon Center. Everyone meets again at Afuri Ramen for dinner at 7:30 PM.</p>
    </LayoutGroup>
  );
}
