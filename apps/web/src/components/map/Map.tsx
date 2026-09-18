"use client";
import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

/** Client-only map (MapLibre needs window). Renders the tinted map background while loading. */
export const Map = dynamic<MapViewProps>(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-map" aria-hidden="true" />,
});
