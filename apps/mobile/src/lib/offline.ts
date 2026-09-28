import { useSyncExternalStore } from "react";
import { useNetworkState } from "expo-network";
import { prefs } from "./supabase";

/** Connectivity, as the OS reports it. `null` reachability (unknown) counts as online so nothing is hidden by mistake. */
export function useOnline(): boolean {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Small per-device JSON preferences (downloaded offline packs, permission sheets shown), loaded
 * from SecureStore once and read through useSyncExternalStore.
 */
function jsonPref<T>(key: string, fallback: T) {
  let value: T = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const load = async () => { if (loaded) return; loaded = true; try { const raw = await prefs.get(key); if (raw) { value = JSON.parse(raw) as T; emit(); } } catch { /* keep the fallback */ } };
  return {
    use(): T { return useSyncExternalStore((l) => { listeners.add(l); void load(); return () => { listeners.delete(l); }; }, () => value, () => value); },
    get: () => value,
    async set(next: T) { value = next; emit(); try { await prefs.set(key, JSON.stringify(next)); } catch { /* storage unavailable */ } },
    /** Test helper: forget what was loaded. */
    reset() { value = fallback; loaded = false; emit(); },
  };
}

/** Offline packs marked as downloaded on this device (pack id → ISO date). */
export const packsStore = jsonPref<Record<string, string>>("offline.packs", {});
/** Permission sheets already shown on this device (capability → asked | declined). */
export const permStore = jsonPref<Record<string, "asked" | "declined">>("permissions.asked", {});
/** When the trip data on this device was last refreshed from the network. */
export const savedAtStore = jsonPref<{ tripId: string; savedAt: string } | null>("offline.savedAt", null);

export function needsPrompt(cap: "location" | "microphone" | "camera"): boolean {
  return !permStore.get()[cap];
}
export function markPrompt(cap: "location" | "microphone" | "camera", allowed: boolean) {
  void permStore.set({ ...permStore.get(), [cap]: allowed ? "asked" : "declined" });
}

/** Wall-clock time for "saved 41 min ago" copy (demo "now" is frozen in 2027, so ago labels use the real clock). */
export function useNow(intervalMs = 30_000): number {
  return useSyncExternalStore((cb) => { const id = setInterval(cb, intervalMs); return () => clearInterval(id); }, () => Math.floor(Date.now() / intervalMs) * intervalMs, () => Math.floor(Date.now() / intervalMs) * intervalMs);
}

export function agoLabel(iso: string, nowMs: number): string {
  const min = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}
