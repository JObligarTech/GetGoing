"use client";
import { useRef } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Bike, Car, Footprints, TrainFront } from "lucide-react";
import { formatDuration, MODE_LABEL, TRAVEL_MODES, type RouteResult, type TravelMode } from "@voya/core";
import { cx } from "@/lib/utils";

const ICON: Record<TravelMode, typeof Footprints> = { walk: Footprints, transit: TrainFront, drive: Car, cycle: Bike };

/** Compare chips — a radiogroup of modes with their durations; arrow keys move, selection navigates. */
export function ModePicker({ results, current, to, from }: { results: Record<TravelMode, RouteResult | null>; current: TravelMode; to: string; from: string }) {
  const router = useRouter();
  const refs = useRef<Partial<Record<TravelMode, HTMLButtonElement | null>>>({});
  const modes = TRAVEL_MODES.filter((m) => results[m]);
  // Focus moves to the new radio synchronously (the buttons stay mounted across the
  // server re-render), then the route re-renders with the chosen mode.
  const go = (m: TravelMode, focus = false) => {
    if (focus) refs.current[m]?.focus();
    router.push(`/navigate/route?to=${to}&from=${from}&mode=${m}` as Route);
  };
  return (
    <div role="radiogroup" aria-label="Travel mode" className="flex flex-wrap gap-1.5">
      {modes.map((m, i) => {
        const Icon = ICON[m];
        const on = m === current;
        return (
          <button
            key={m}
            ref={(el) => { refs.current[m] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${MODE_LABEL[m]}, ${formatDuration(results[m]!.durationSec)}`}
            tabIndex={on ? 0 : -1}
            onClick={() => go(m)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(modes[(i + 1) % modes.length]!, true); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(modes[(i - 1 + modes.length) % modes.length]!, true); }
            }}
            className={cx("flex h-9 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-[13px] font-bold transition-colors duration-(--dur-fast)", on ? "bg-primary text-on-primary" : "bg-tint text-on-tint hover:bg-primary/15")}
          >
            <Icon aria-hidden="true" size={16} />
            {formatDuration(results[m]!.durationSec)}
          </button>
        );
      })}
    </div>
  );
}
