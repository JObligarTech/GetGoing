"use client";
import { createLocalStore } from "@/lib/local-store";

/**
 * What the device keeps for the active trip so the app stays readable offline (mockup 6b).
 * The page data itself is served by the browser's back/forward cache and the offline packs
 * in Settings; this summary drives the banner and the "Available offline" card.
 */
export interface OfflineSummary {
  tripId: string;
  tripName: string;
  city: string;
  savedAt: string;
  places: number;
  routes: number;
  phrases: number;
  langPack: string | null;
  fx: { pair: string; asOf: string } | null;
}
export const offlineStore = createLocalStore<OfflineSummary | null>("voya-offline", null);

/** Downloaded offline packs, per device (pack id → ISO date). Mirrors Settings → Offline. */
export const packsStore = createLocalStore<Record<string, string>>("voya-offline-packs", {});

/** Permission pre-prompts already shown on this device (capability → "asked" | "declined"). */
export const permStore = createLocalStore<Record<string, "asked" | "declined">>("voya-permissions", {});

export function agoLabel(iso: string, nowMs: number): string {
  const min = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
