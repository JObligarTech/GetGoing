"use client";
import { useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cx } from "@/lib/utils";

export interface SegmentOption<T extends string> { value: T; label: string; ariaLabel?: string }

/**
 * Radio-group segmented control (day picker, view switcher). Arrow keys move
 * between options; the active pill slides with a layout animation.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, size = "md", className }: {
  options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; label: string; size?: "sm" | "md"; className?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex gap-1 rounded-lg border border-line-strong bg-surface p-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
            }}
            className={cx(
              "relative flex items-center justify-center rounded-md font-bold transition-colors duration-(--dur-fast)",
              size === "sm" ? "h-8 min-w-9 px-2 text-[13px]" : "h-10 min-w-11 px-3 text-[13px]",
              active ? "text-on-primary" : "text-muted hover:text-ink",
            )}
          >
            {active && <motion.span layoutId={`${id}-pill`} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-md bg-primary" aria-hidden="true" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
