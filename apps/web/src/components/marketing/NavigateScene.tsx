"use client";
import { useEffect, useState } from "react";
import { Bike, Car, Footprints, TrainFront } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cx } from "@/lib/utils";

const MODES = [
  { key: "transit", label: "Transit", min: 23, Icon: TrainFront, d: "M40 250 C 80 250, 90 200, 130 190 S 210 170, 230 120 S 300 70, 340 60", fare: "¥360" },
  { key: "walk", label: "Walk", min: 41, Icon: Footprints, d: "M40 250 C 60 220, 100 230, 140 205 S 190 150, 240 140 S 310 95, 340 60", fare: "¥0" },
  { key: "drive", label: "Drive", min: 12, Icon: Car, d: "M40 250 L 120 250 L 120 150 L 260 150 L 260 60 L 340 60", fare: "~¥1,800" },
  { key: "cycle", label: "Cycle", min: 16, Icon: Bike, d: "M40 250 C 90 240, 120 210, 160 200 S 240 140, 280 110 S 320 75, 340 60", fare: "¥0" },
];
const BLOCKS = [[20, 40, 70, 50], [110, 30, 90, 60], [220, 20, 60, 30], [30, 120, 60, 40], [120, 110, 80, 30], [230, 100, 70, 40], [60, 190, 50, 40], [170, 220, 90, 40], [280, 180, 60, 60]];

/**
 * Directions, drawn: the route from the hotel to dinner draws itself for one mode,
 * then the next mode takes over. Real numbers from the demo trip. Under reduced motion
 * the transit route is simply shown.
 */
export function NavigateScene() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((x) => (x + 1) % MODES.length), 3600);
    return () => clearInterval(id);
  }, [reduce]);
  const m = MODES[i]!;

  return (
    <div className="card overflow-hidden">
      <div aria-hidden="true" className="relative bg-map" style={{ aspectRatio: "380 / 290" }}>
        <svg viewBox="0 0 380 290" className="absolute inset-0 h-full w-full">
          {BLOCKS.map(([x, y, w, h], k) => <rect key={k} x={x} y={y} width={w} height={h} rx={6} fill="var(--c-surface)" opacity={0.7} />)}
          <path d="M0 160 H380 M150 0 V290 M260 0 V290" stroke="var(--c-surface)" strokeWidth={10} opacity={0.9} />
          <motion.path key={m.key} d={m.d} fill="none" stroke="var(--c-surface)" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeInOut" }} />
          <motion.path key={`${m.key}-l`} d={m.d} fill="none" stroke="var(--c-primary)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeInOut" }} />
          <circle cx={40} cy={250} r={7} fill="#1B211C" stroke="var(--c-surface)" strokeWidth={3} />
          <circle cx={340} cy={60} r={7} fill="#E0703A" stroke="var(--c-surface)" strokeWidth={3} />
        </svg>
        <span className="raised absolute top-3 left-3 flex h-8 items-center gap-2 rounded-pill px-3 text-[12px] font-bold"><span className="h-2.5 w-2.5 rounded-full bg-[#1B211C]" />Hotel Gracery</span>
        <span className="raised absolute right-3 bottom-3 flex h-8 items-center gap-2 rounded-pill px-3 text-[12px] font-bold"><span className="h-2.5 w-2.5 rounded-full bg-[#E0703A]" />Afuri Ramen · Dinner</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <p aria-live="off"><span className="text-[26px] font-extrabold tracking-[-0.02em] tabular-nums">{m.min} min</span><span className="ml-2 text-[13px] text-muted">arrive {arrive(m.min)}</span></p>
          <span className="text-[15px] font-bold tabular-nums">{m.fare}</span>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
          {MODES.map((x, k) => (
            <span key={x.key} className={cx("flex h-9 items-center gap-1.5 rounded-pill px-3 text-[13px] font-bold transition-colors duration-(--dur-base)", k === i ? "bg-primary text-on-primary" : "bg-tint text-on-tint")}>
              <x.Icon size={16} />{x.min} min
            </span>
          ))}
        </div>
        <p className="sr-only">Directions from Hotel Gracery to Afuri Ramen compared across transit, 23 minutes for 360 yen; walking, 41 minutes; driving, 12 minutes; cycling, 16 minutes.</p>
      </div>
    </div>
  );
}

function arrive(min: number) {
  const t = 18 * 60 + 41 + min; // leaving 6:41 PM, like the demo's clock
  const h = Math.floor(t / 60) % 24, mm = t % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
