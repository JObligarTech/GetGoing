import { buildHtml } from "@/components/MapView";

describe("TripMap HTML", () => {
  const base = { center: { lat: 35.6, lng: 139.7 }, zoom: 13, dark: false, interactive: false };

  it("cannot be broken out of by a hostile place name", () => {
    const html = buildHtml({ ...base, pins: [{ id: "x", lat: 1, lng: 2, color: "#E0703A", label: "</script><script>alert(1)</script>" }] });
    // Exactly the two legitimate <script> tags (CDN + init); the label is escaped inside the JSON string.
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html).toContain("\\u003c/script>");
  });

  it("only accepts #RRGGBB colours and finite numbers", () => {
    const html = buildHtml({ ...base, center: { lat: NaN, lng: 139.7 }, pins: [{ id: "x", lat: 1, lng: 2, color: "red;background:url(javascript:1)" }] });
    expect(html).toContain('"color":"#2F5D3A"');
    expect(html).toContain("center:[139.7,0]");
  });

  it("draws a route line only when there is a path, with sanitised coordinates", () => {
    expect(buildHtml({ ...base, pins: [] })).toContain("var line=[];");
    const html = buildHtml({ ...base, pins: [], path: [{ lat: 35.6, lng: 139.7 }, { lat: NaN, lng: 139.71 }] });
    expect(html).toContain("var line=[[139.7,35.6],[139.71,0]];");
    expect(html).toContain("addLayer({id:'rl'");
  });

  it("locks the WebView down with a CSP", () => {
    const html = buildHtml({ ...base, pins: [] });
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("img-src https://tile.openstreetmap.org");
  });
});
