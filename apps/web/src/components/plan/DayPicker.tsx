"use client";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/** Day 1..N picker; navigates to /plan?day=YYYY-MM-DD. Shows a 3-day window around the current day (per the mockup). */
export function DayPicker({ dates, current, view }: { dates: string[]; current: string; view: "day" | "map" }) {
  const router = useRouter();
  const idx = Math.max(0, dates.indexOf(current));
  const start = Math.max(0, Math.min(idx - 1, dates.length - 3));
  const window = dates.slice(start, start + 3);
  return (
    <SegmentedControl
      label="Trip day"
      size="sm"
      value={current}
      onChange={(d) => router.push(`/plan?day=${d}&view=${view}`)}
      options={window.map((d) => ({ value: d, label: String(dates.indexOf(d) + 1), ariaLabel: `Day ${dates.indexOf(d) + 1}, ${d}` }))}
    />
  );
}
