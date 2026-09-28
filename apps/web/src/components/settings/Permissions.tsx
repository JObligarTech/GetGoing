"use client";
import { useEffect, useState } from "react";
import { Bell, Camera, Image as ImageIcon, MapPin, Mic, Users } from "lucide-react";
import { PERMISSION_ROWS } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { permStore } from "@/lib/offline";
import { cx } from "@/lib/utils";

type Name = "geolocation" | "microphone" | "camera" | "notifications";
type State = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

const ICONS = { location: MapPin, microphone: Mic, camera: Camera, photos: ImageIcon, contacts: Users, notifications: Bell } as const;
const ROWS = PERMISSION_ROWS.map((r) => ({ ...r, key: (r.key === "location" ? "geolocation" : r.key) as Name | "photos" | "contacts", Icon: ICONS[r.key] }));

function label(state: State, key: string, declined: boolean): { text: string; tone: "on" | "off" | "muted" } {
  if (key === "photos") return { text: "Selected only · asked each time", tone: "muted" };
  if (key === "contacts") return { text: "Not available on the web", tone: "muted" };
  if (state === "granted") return { text: key === "geolocation" ? "While using" : "Allowed", tone: "on" };
  if (state === "denied") return { text: "Off · allow it in your browser's site settings", tone: "off" };
  if (state === "unsupported") return { text: "Not available in this browser", tone: "muted" };
  if (declined) return { text: "Declined in Get Going · ask again from the feature", tone: "muted" };
  return { text: "Not asked yet", tone: "muted" };
}

/**
 * Permissions (mockup 7a): the state of each capability on this device and how to recover
 * when it's off. Browsers can't deep-link to their site settings, so the copy says where to look.
 */
export function Permissions() {
  const [states, setStates] = useState<Record<string, State>>({});
  const asked = permStore.use();
  useEffect(() => {
    let alive = true;
    const query = async (name: Name): Promise<State> => {
      try {
        if (!("permissions" in navigator)) return "unsupported";
        const s = await navigator.permissions.query({ name: name as PermissionName });
        return s.state as State;
      } catch { return name === "notifications" && "Notification" in window ? (Notification.permission === "default" ? "prompt" : (Notification.permission as State)) : "unsupported"; }
    };
    Promise.all((["geolocation", "microphone", "camera", "notifications"] as Name[]).map(async (n) => [n, await query(n)] as const)).then((pairs) => { if (alive) setStates(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, []);
  const reset = () => permStore.set({});
  return (
    <>
      {ROWS.map(({ key, title, detail, Icon, fallback }) => {
        const state = states[key] ?? "unknown";
        const { text, tone } = label(state, key, asked[key === "geolocation" ? "location" : key] === "declined");
        return (
          <div key={key} className="flex items-center gap-3 px-3.5 py-3">
            <span aria-hidden="true" className={cx("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md", tone === "off" ? "bg-danger/10 text-danger" : "bg-tint text-primary")}><Icon size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{title}</span>
              <span className="block text-[12px] text-muted">{detail}</span>
              <span className={cx("block text-[12px] font-bold", tone === "on" ? "text-primary" : tone === "off" ? "text-danger" : "text-muted")}>{text}{tone === "off" ? ` · ${fallback}` : ""}</span>
            </span>
            {tone === "off" && <Button variant="secondary" size="sm" href="/legal/privacy" aria-label={`How to allow ${title.toLowerCase()} again`}>How</Button>}
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <span className="text-[12.5px] text-muted">Get Going explains each permission once before your browser asks. Reset to see the explanations again.</span>
        <Button variant="ghost" size="sm" onClick={reset} disabled={Object.keys(asked).length === 0}>Reset</Button>
      </div>
    </>
  );
}
