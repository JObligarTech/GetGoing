"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Map as MLMap, Marker, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPin } from "@voya/core";
import { cx } from "@/lib/utils";

export interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pins?: MapPin[];
  /** Non-interactive (Home card, previews). */
  static?: boolean;
  /** Tint the basemap for dark mode; defaults to following the document theme. */
  dark?: boolean;
  className?: string;
  /** Accessible description of what the map shows. */
  label: string;
  onPinClick?: (pin: MapPin) => void;
}

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function isDocDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
/** Subscribes to both the OS preference and the data-theme attribute the ThemeToggle writes. */
function subscribeDocTheme(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => { mq.removeEventListener("change", cb); mo.disconnect(); };
}

function pinElement(pin: MapPin, dark: boolean): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  // Pins are rendered above the tinted basemap, so we counter the dark-mode invert.
  if (pin.label) {
    const bg = pin.dark ? "#1B211D" : "#fff", fg = pin.dark ? "#fff" : "#1B211C";
    el.style.cssText = `display:flex;align-items:center;gap:6px;height:30px;padding:0 10px 0 6px;border-radius:999px;background:${bg};color:${fg};font:600 12px var(--font-manrope),Manrope,sans-serif;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,${dark ? ".5" : ".18"});cursor:default`;
    const dot = document.createElement("span");
    dot.style.cssText = `width:18px;height:18px;border-radius:50%;background:${pin.color};flex:none`;
    el.append(dot, document.createTextNode(pin.label));
  } else {
    el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${pin.color};box-shadow:0 0 0 8px ${pin.color}40,0 0 0 20px ${pin.color}1a`;
  }
  return el;
}

/**
 * OpenStreetMap raster tiles via MapLibre. Matches the mockups' voya-map element:
 * desaturated light basemap, inverted/hue-rotated dark basemap, pill markers.
 * Screen readers get a text summary of the pins instead of the canvas.
 */
export function MapView({ center, zoom = 13, pins = [], static: isStatic, dark, className, label, onPinClick }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const docDark = useSyncExternalStore(subscribeDocTheme, isDocDark, () => false);
  const isDark = dark ?? docDark;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new MLMap({
      container: ref.current,
      style: OSM_STYLE,
      center: [center.lng, center.lat],
      zoom,
      interactive: !isStatic,
      attributionControl: false,
      // Keyboard panning is handled by the page, not the canvas, to avoid a focus trap.
      keyboard: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.on("error", (e) => { if (e.error?.message?.includes("tile")) setFailed(true); });
    // MapLibre makes its canvas tabbable; keyboard panning is off, so it would be a dead tab stop.
    map.getCanvas().tabIndex = -1;
    map.on("load", () => setFailed(false));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // Initial-only: later changes are applied imperatively below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.jumpTo({ center: [center.lng, center.lat], zoom });
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = pins.map((pin) => {
      const el = pinElement(pin, isDark);
      if (onPinClick) { el.style.cursor = "pointer"; el.addEventListener("click", () => onPinClick(pin)); }
      return new Marker({ element: el, anchor: pin.label ? "left" : "center" }).setLngLat([pin.lng, pin.lat]).addTo(map);
    });
  }, [pins, isDark, onPinClick]);

  const tint = isDark
    ? "invert(1) hue-rotate(180deg) brightness(.85) saturate(.4)"
    : "saturate(.55) contrast(.95)";

  return (
    <div className={cx("relative h-full w-full overflow-hidden bg-map", className)} role="img" aria-label={label}>
      <div ref={ref} className="absolute inset-0 [&_.maplibregl-canvas-container]:h-full" style={{ filter: tint }} />
      {/* Markers live inside the filtered container; undo the filter on them so colours stay true. */}
      <style>{`.maplibregl-marker{filter:${isDark ? "invert(1) hue-rotate(180deg) brightness(1.18) saturate(2.5)" : "saturate(1.82) contrast(1.05)"}}`}</style>
      {failed && !isStatic && (
        <p role="status" className="absolute inset-0 flex items-center justify-center bg-map text-[13px] font-semibold text-muted">Map unavailable offline</p>
      )}
      <p className="pointer-events-none absolute right-1.5 bottom-1 z-2 rounded-sm bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium text-muted">© OpenStreetMap contributors</p>
      {pins.length > 0 && (
        <ul className="sr-only">
          {pins.map((p) => <li key={p.id}>{p.label ?? "Pin"}</li>)}
        </ul>
      )}
    </div>
  );
}
