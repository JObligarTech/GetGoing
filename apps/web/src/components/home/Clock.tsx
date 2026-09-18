"use client";
import { useEffect, useState } from "react";
import { formatTime, tzOffsetLabel } from "@voya/core";

/**
 * Local vs home time card over the map. Renders the server value first (no
 * hydration mismatch), then ticks each minute on the client.
 */
export function Clock({ city, tz, homeTz, initialNow, frozen }: { city: string; tz: string; homeTz: string; initialNow: string; frozen?: boolean }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    if (frozen) return;
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [frozen]);
  const local = formatTime(now, tz);
  const home = formatTime(now, homeTz);
  const offset = tzOffsetLabel(now, tz, homeTz);
  return (
    <div className="raised rounded-lg px-3 py-2 text-right" aria-live="off">
      <p className="text-[11px] font-semibold tracking-[.06em] text-muted uppercase">{city}</p>
      <p className="text-[20px] leading-[1.1] font-extrabold"><time dateTime={now.toISOString()}>{local}</time></p>
      <p className="text-[11px] text-muted">Home {home} · {offset}</p>
    </div>
  );
}
