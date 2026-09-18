import { CornerUpLeft, Flag, Footprints, TrainFront } from "lucide-react";
import type { RouteStep } from "@voya/core";
import { cx } from "@/lib/utils";

const ICON: Record<RouteStep["kind"], typeof Footprints> = { walk: Footprints, transit: TrainFront, turn: CornerUpLeft, arrive: Flag };

/** Step glyph; `filled` is the green square used on the turn card. */
export function StepIcon({ kind, filled }: { kind: RouteStep["kind"]; filled?: boolean }) {
  const Icon = ICON[kind];
  return (
    <span aria-hidden="true" className={cx("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md", filled ? "h-11 w-11 rounded-lg bg-primary text-on-primary" : "bg-tint text-on-tint")}>
      <Icon size={20} />
    </span>
  );
}
