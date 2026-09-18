import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import type { MapPin } from "@voya/core";
import { useTheme } from "@/lib/theme";

/**
 * OpenStreetMap tiles via MapLibre inside a WebView — runs in Expo Go on both
 * platforms with no API keys or native map SDK. The same tint filters and pill
 * markers as the web MapView. Screen readers get `label` instead of the canvas.
 * MapLibre is loaded from jsDelivr with an integrity hash pinned to 5.x.
 */
export function TripMap({ center, zoom = 13, pins = [], dark, label, style, interactive = false }: {
  center: { lat: number; lng: number }; zoom?: number; pins?: MapPin[]; dark?: boolean; label: string; style?: StyleProp<ViewStyle>; interactive?: boolean;
}) {
  const t = useTheme();
  const isDark = dark ?? t.scheme === "dark";
  const html = useMemo(() => buildHtml({ center, zoom, pins, dark: isDark, interactive }), [center, zoom, pins, isDark, interactive]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[{ overflow: "hidden", backgroundColor: t.mapBg }, style]}>
      <WebView
        originWhitelist={["about:blank"]}
        source={{ html, baseUrl: "about:blank" }}
        scrollEnabled={interactive}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowsInlineMediaPlayback={false}
        setSupportMultipleWindows={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}

export function buildHtml(o: { center: { lat: number; lng: number }; zoom: number; pins: MapPin[]; dark: boolean; interactive: boolean }) {
  const tint = o.dark ? "invert(1) hue-rotate(180deg) brightness(.85) saturate(.4)" : "saturate(.55) contrast(.95)";
  const unfilter = o.dark ? "invert(1) hue-rotate(180deg) brightness(1.18) saturate(2.5)" : "saturate(1.82) contrast(1.05)";
  // JSON inside a <script>: escape "<" so a label like "</script>" can't close the tag, and
  // U+2028/2029 which are line terminators in JS but not JSON. Labels are rendered via textContent.
  const pins = JSON.stringify(o.pins.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), label: p.label ?? null, color: /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#2F5D3A", dark: !!p.dark })))
    .replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const num = (n: number) => (Number.isFinite(n) ? String(n) : "0");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://cdn.jsdelivr.net 'unsafe-inline'; style-src https://cdn.jsdelivr.net 'unsafe-inline'; img-src https://tile.openstreetmap.org data: blob:; connect-src https://tile.openstreetmap.org; worker-src blob:; child-src blob:">
<link href="https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.css" rel="stylesheet">
<style>html,body,#m{margin:0;height:100%;background:${o.dark ? "#1B1F1C" : "#E9ECE6"}}#m{filter:${tint}}.maplibregl-marker{filter:${unfilter}}.maplibregl-ctrl{display:none}
.pill{display:flex;align-items:center;gap:6px;height:30px;padding:0 10px 0 6px;border-radius:999px;font:600 12px -apple-system,Manrope,sans-serif;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.18)}.pill i{width:18px;height:18px;border-radius:50%;display:block}
.dot{width:14px;height:14px;border-radius:50%}</style></head><body><div id="m"></div>
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.js" crossorigin="anonymous"></script>
<script>
var map=new maplibregl.Map({container:'m',style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19}},layers:[{id:'osm',type:'raster',source:'osm'}]},center:[${num(o.center.lng)},${num(o.center.lat)}],zoom:${num(o.zoom)},interactive:${o.interactive ? "true" : "false"},attributionControl:false});
${pins}.forEach(function(p){var el=document.createElement('div');if(p.label){el.className='pill';el.style.background=p.dark?'#1B211D':'#fff';el.style.color=p.dark?'#fff':'#1B211C';var i=document.createElement('i');i.style.background=p.color;el.appendChild(i);el.appendChild(document.createTextNode(p.label));}else{el.className='dot';el.style.background=p.color;el.style.boxShadow='0 0 0 8px '+p.color+'40,0 0 0 20px '+p.color+'1a';}
new maplibregl.Marker({element:el,anchor:p.label?'left':'center'}).setLngLat([p.lng,p.lat]).addTo(map);});
</script></body></html>`;
}
