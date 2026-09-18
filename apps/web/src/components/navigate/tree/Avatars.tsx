import { initial } from "@voya/core";
import type { TreeTraveler } from "./types";

/** Stacked initials; the list of names is the accessible name. */
export function Avatars({ travelers, size = 22, ring = "var(--c-surface)" }: { travelers: TreeTraveler[]; size?: number; ring?: string }) {
  if (!travelers.length) return null;
  return (
    <span role="img" aria-label={travelers.map((t) => t.name.split(" ")[0]).join(", ")} className="inline-flex items-center">
      {travelers.map((t, i) => (
        <span key={t.id} aria-hidden="true" className="inline-flex items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: t.color, border: `2px solid ${ring}`, marginLeft: i ? -Math.round(size * 0.3) : 0 }}>
          {initial(t.name)}
        </span>
      ))}
    </span>
  );
}
