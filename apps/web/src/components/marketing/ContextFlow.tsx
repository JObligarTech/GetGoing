"use client";
import { useEffect, useState } from "react";
import { Compass, GitFork, Languages, Receipt } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Dot, Tile } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";

const CONTEXT = [
  { id: "hotel", label: "Hotel Gracery Shinjuku", color: "#7DBA8E", tool: 0 },
  { id: "travelers", label: "4 travelers", color: "#C9516F", tool: 1 },
  { id: "language", label: "日本語", color: "#5568C9", tool: 2 },
  { id: "currency", label: "JPY", color: "#E0A020", tool: 3 },
];
const TOOLS = [
  { name: "Navigate", Icon: Compass, uses: "Take me to my hotel" },
  { name: "Tree routes", Icon: GitFork, uses: "Split into Group A and B" },
  { name: "Translate", Icon: Languages, uses: "Show this address in 日本語", soon: true },
  { name: "Split", Icon: Receipt, uses: "Divide dinner four ways", soon: true },
];

/**
 * "Voya remembers": pieces of trip context leave the trip card and land in the tool
 * that needs them, one at a time, on a loop. Shared-layout animation moves the very
 * same chip. At rest (and under reduced motion) every chip sits in the trip card.
 */
export function ContextFlow() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = setInterval(() => { setActive(i % CONTEXT.length); i += 1; }, 2200);
    return () => clearInterval(id);
  }, [reduce]);

  const chip = (c: (typeof CONTEXT)[number]) => (
    <motion.span key={c.id} layoutId={`ctx-${c.id}`} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="inline-flex h-8 items-center gap-2 rounded-pill border border-line bg-surface px-3 text-[13px] font-bold whitespace-nowrap">
      <Dot color={c.color} size={8} />{c.label}
    </motion.span>
  );

  return (
    <LayoutGroup>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Tile name="Japan 2027" size={44} />
            <div><p className="text-[15px] font-extrabold">Japan 2027</p><p className="text-[12px] text-muted">Tokyo → Kyoto → Osaka · Mar 15–29</p></div>
          </div>
          <div className="mt-4 flex min-h-[88px] flex-wrap gap-2">
            {CONTEXT.map((c, i) => (i === active ? <span key={c.id} className="h-8 w-[1px]" /> : chip(c)))}
          </div>
        </div>
        <div className="hidden h-px w-14 bg-line-strong md:block" />
        <ul className="grid gap-2">
          {TOOLS.map((t, i) => {
            const c = CONTEXT.find((x) => x.tool === i)!;
            const on = active === i;
            return (
              <li key={t.name} className={cx("card flex min-h-14 items-center gap-3 px-3.5 py-2.5 transition-colors duration-(--dur-base)", on && "bg-tint")}>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-tint text-primary"><t.Icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{t.name}{t.soon && <span className="ml-2 rounded-sm bg-premium-bg px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-premium-text">next</span>}</span>
                  <span className="block truncate text-[12px] text-muted">{t.uses}</span>
                </span>
                {on && chip(c)}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="sr-only">The trip card for Japan 2027 holds the hotel, the travelers, the language and the currency. Each one flows into the tool that needs it: the hotel into Navigate, the travelers into tree routes, the language into Translate, the currency into Split.</p>
    </LayoutGroup>
  );
}
