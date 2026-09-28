"use client";
import { useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed store read through useSyncExternalStore, so components
 * render the server fallback first and the device's value after hydration with no
 * setState-in-effect. Values are per device and never leave the browser.
 */
export function createLocalStore<T>(key: string, fallback: T) {
  let cached: T | undefined;
  const listeners = new Set<() => void>();
  const read = (): T => {
    if (cached !== undefined) return cached;
    try { const raw = localStorage.getItem(key); cached = raw ? (JSON.parse(raw) as T) : fallback; } catch { cached = fallback; }
    return cached;
  };
  const emit = () => listeners.forEach((l) => l());
  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => { if (e.key === key) { cached = undefined; emit(); } };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
  };
  return {
    use: (): T => useSyncExternalStore(subscribe, read, () => fallback),
    set(value: T) { cached = value; try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: memory only */ } emit(); },
    get: read,
  };
}

const noop = () => () => {};
/** Static browser capability, rendered as `serverValue` on the server and during hydration. */
export function useCapability(check: () => boolean, serverValue = true): boolean {
  return useSyncExternalStore(noop, check, () => serverValue);
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb); window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** A ticking clock for "saved 41 min ago" copy, read through useSyncExternalStore so render stays pure. */
export function useNow(intervalMs = 30_000): number {
  return useSyncExternalStore(
    (cb) => { const id = setInterval(cb, intervalMs); return () => clearInterval(id); },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}
