import { describe, expect, it, vi } from "vitest";
import { createFrankfurterFx } from "./frankfurter";
import { mockFx, mockGeocode, mockTranslation } from "./mock";
import { createNominatimGeocode } from "./nominatim";
import { resolveProviders } from "./index";

describe("mock providers", () => {
  it("geocode finds by name or kind", async () => {
    expect((await mockGeocode.search("fuglen")).map((r) => r.name)).toEqual(["Fuglen Tokyo"]);
    expect((await mockGeocode.search("cafe")).length).toBeGreaterThan(1);
    expect(await mockGeocode.search("  ")).toEqual([]);
  });
  it("fx inverts rates", async () => {
    expect((await mockFx.rate("JPY", "USD")).rate).toBeCloseTo(1 / 149.7);
    await expect(mockFx.rate("XXX", "YYY")).rejects.toThrow();
  });
  it("translation returns the canonical phrase", async () => {
    const r = await mockTranslation.translate("Can we have separate checks, please?", "en", "ja");
    expect(r.text).toBe("別々に会計できますか？");
  });
});

describe("real adapters (fetch mocked)", () => {
  it("nominatim maps results and sends a User-Agent", async () => {
    const fetchImpl = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toContain("countrycodes=jp");
      expect((init?.headers as Record<string, string>)["User-Agent"]).toContain("Voya");
      return new Response(JSON.stringify([{ place_id: 1, lat: "35.6", lon: "139.7", display_name: "Fuglen, Tomigaya, Tokyo", namedetails: { "name:ja": "フグレン" } }]));
    }) as unknown as typeof fetch;
    const g = createNominatimGeocode({ userAgent: "Voya/test", fetchImpl });
    const r = await g.search("fuglen", { countryCodes: ["JP"] });
    expect(r[0]).toMatchObject({ provider: "osm", name: "Fuglen", localName: "フグレン", location: { lat: 35.6, lng: 139.7 } });
  });
  it("frankfurter parses rates", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ date: "2026-09-18", rates: { JPY: 150.1 } }))) as unknown as typeof fetch;
    const fx = createFrankfurterFx({ fetchImpl });
    expect(await fx.rate("USD", "JPY")).toEqual({ base: "USD", quote: "JPY", rate: 150.1, asOf: "2026-09-18" });
  });
  it("resolveProviders defaults to mocks", () => {
    const p = resolveProviders({});
    expect(p.geocode).toBe(mockGeocode);
  });
});
