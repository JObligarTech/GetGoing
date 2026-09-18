import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import type { LatLng, MapPin } from "@voya/core";
import { useTheme } from "@/lib/theme";

/**
 * OpenStreetMap tiles via MapLibre inside a WebView — runs in Expo Go on both
 * platforms with no API keys or native map SDK. The same tint filters and pill
 * markers as the web MapView. Screen readers get `label` instead of the canvas.
 * MapLibre is loaded from jsDelivr with an integrity hash pinned to 5.x.
 */
export function TripMap({ center, zoom = 13, pins = [], path, paths, dark, label, style, interactive = false }: {
  center: { lat: number; lng: number }; zoom?: number; pins?: MapPin[]; path?: LatLng[]; paths?: { points: LatLng[]; color: string }[]; dark?: boolean; label: string; style?: StyleProp<ViewStyle>; interactive?: boolean;
}) {
  const t = useTheme();
  const isDark = dark ?? t.scheme === "dark";
  const html = useMemo(() => buildHtml({ center, zoom, pins, path, paths, dark: isDark, interactive }), [center, zoom, pins, path, paths, isDark, interactive]);
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

export function buildHtml(o: { center: { lat: number; lng: number }; zoom: number; pins: MapPin[]; path?: LatLng[]; paths?: { points: LatLng[]; color: string }[]; dark: boolean; interactive: boolean }) {
  const tint = o.dark ? "invert(1) hue-rotate(180deg) brightness(.85) saturate(.4)" : "saturate(.55) contrast(.95)";
  const unfilter = o.dark ? "invert(1) hue-rotate(180deg) brightness(1.18) saturate(2.5)" : "saturate(1.82) contrast(1.05)";
  // JSON inside a <script>: escape "<" so a label like "</script>" can't close the tag, and
  // U+2028/2029 which are line terminators in JS but not JSON. Labels are rendered via textContent.
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const num = (n: number) => (Number.isFinite(n) ? String(n) : "0");
  const pins = json(o.pins.map((p) => ({ lat: Number(num(p.lat)), lng: Number(num(p.lng)), label: p.label ?? null, color: /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#2F5D3A", dark: !!p.dark })));
  // Route lines as {c: colour, p: [lng,lat][]}; drawn under the markers once the style has loaded.
  const hex = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : "#2F5D3A");
  const lines = o.paths ?? (o.path ? [{ points: o.path, color: "#2F5D3A" }] : []);
  const line = json(lines.filter((l) => l.points.length > 1).map((l) => ({ c: hex(l.color), p: l.points.map((p) => [Number(num(p.lng)), Number(num(p.lat))]) })));
  const casing = o.dark ? "#0F1A13" : "#ffffff";
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
var lines=${line};if(lines.length){map.on('load',function(){map.addSource('r',{type:'geojson',data:{type:'FeatureCollection',features:lines.map(function(l){return {type:'Feature',properties:{color:l.c},geometry:{type:'LineString',coordinates:l.p}};})}});
map.addLayer({id:'rc',type:'line',source:'r',paint:{'line-color':'${casing}','line-width':9,'line-opacity':.9},layout:{'line-cap':'round','line-join':'round'}});
map.addLayer({id:'rl',type:'line',source:'r',paint:{'line-color':['get','color'],'line-width':5},layout:{'line-cap':'round','line-join':'round'}});
var all=[].concat.apply([],lines.map(function(l){return l.p;}));var b=all.reduce(function(a,c){return a.extend(c);},new maplibregl.LngLatBounds(all[0],all[0]));map.fitBounds(b,{padding:56,duration:0,maxZoom:15});});}
</script></body></html>`;
}
