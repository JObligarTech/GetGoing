"use client";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx } from "@/lib/utils";

type Pref = "system" | "light" | "dark";
const KEY = "voya-theme";

const EVENT = "voya-theme-change";
function readPref(): Pref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

export function useThemePref(): [Pref, (p: Pref) => void] {
  const pref = useSyncExternalStore(subscribe, readPref, (): Pref => "system");
  const apply = (p: Pref) => {
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {}
    if (p === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = p;
    window.dispatchEvent(new Event(EVENT));
  };
  return [pref, apply];
}

const OPTIONS: { value: Pref; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Follow system", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** Radio-group styled segmented control. Announces as "Theme, Light, selected". */
export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useThemePref();
  return (
    <div role="radiogroup" aria-label="Theme" className={cx("inline-flex gap-1 rounded-lg border border-line-strong bg-surface p-1", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setPref(value)}
            className={cx(
              "flex h-8 min-w-9 items-center justify-center rounded-md px-2 text-[13px] font-bold transition-colors duration-(--dur-fast)",
              active ? "bg-primary text-on-primary" : "text-muted hover:bg-tint",
            )}
          >
            <Icon aria-hidden="true" size={16} />
          </button>
        );
      })}
    </div>
  );
}
