import type { ReactNode } from "react";
import type { PassMark as Mark } from "@voya/core";
import { Chip, Tile } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";

/** The Atlas Premium Pass mark (mockup 8a): a four-point compass star on the accent amber, never on the green primary. */
export function PassStar({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 1.5 14.6 9.4 22.5 12l-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6Z" />
    </svg>
  );
}

/**
 * Avatar with the pass mark: holders get the amber ring and corner badge, gifted access the ring only.
 * Decorative unless `label` is given (then it's an image with that name).
 */
export function Avatar({ name, color, size = 40, mark = null, label, className }: { name: string; color?: string; size?: number; mark?: Mark; label?: string; className?: string }) {
  const badge = Math.max(14, Math.round(size * 0.4));
  return (
    <span className={cx("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Tile name={name} color={color} size={size} radius={999} className={cx(mark && "ring-2 ring-premium ring-offset-2 ring-offset-surface")} />
      {mark === "pass" && (
        <span className="absolute -right-1 -bottom-1 inline-flex items-center justify-center rounded-full border-2 border-surface bg-premium text-white" style={{ width: badge, height: badge }}>
          <PassStar size={Math.round(badge * 0.6)} />
        </span>
      )}
    </span>
  );
}

/** "Atlas Premium Pass" chip (light) or the dark gifted state: "Atlas · GIFTED · 2d left". */
export function PassChip({ mark, children, className }: { mark?: Mark; children?: ReactNode; className?: string }) {
  // Always dark, whatever the theme: fixed colours (amber on near-black ≈ 9.6:1), not the theme's ink which flips in dark mode.
  if (mark === "gifted") return <span className={cx("inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 text-[11.5px] font-bold", className)} style={{ background: "#121614", color: "#F1F3EF" }}><PassStar size={11} className="text-[#F2B441]" />Atlas{children ? <span className="font-extrabold tracking-wide" style={{ color: "#F2B441" }}>· {children}</span> : null}</span>;
  return <Chip tone="premium" className={cx("gap-1.5", className)}><PassStar size={11} />{children ?? "Atlas Premium Pass"}</Chip>;
}
