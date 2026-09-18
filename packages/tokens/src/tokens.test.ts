import { describe, expect, it } from "vitest";
import { composite, contrastRatio } from "./contrast";
import { dark, light, palette, type ColorTheme } from "./index";

const AA_TEXT = 4.5;
const AA_LARGE = 3;

function checkTheme(name: string, t: ColorTheme) {
  describe(`${name} theme meets WCAG AA`, () => {
    it("body text on canvas and surface", () => {
      expect(contrastRatio(t.text, t.canvas, t.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(t.text, t.surface, t.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it("muted text on canvas and surface", () => {
      expect(contrastRatio(t.textMuted, t.canvas, t.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(t.textMuted, t.surface, t.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it("primary button label", () => {
      expect(contrastRatio(t.onPrimary, t.primary, t.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it("ink button label", () => {
      expect(contrastRatio(t.onInk, t.ink, t.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it("tint text on tinted surface, including a chip on an already-tinted row", () => {
      expect(contrastRatio(t.onTint, t.surfaceTint, t.surface)).toBeGreaterThanOrEqual(AA_TEXT);
      const rowBg = `rgb(${composite(t.surfaceTint, t.surface).join(",")})`;
      expect(contrastRatio(t.onTint, t.surfaceTint, rowBg)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it("premium text on premium background", () => {
      expect(contrastRatio(t.premiumText, t.premiumBg, t.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it("focus ring is visible against surface (non-text 3:1)", () => {
      expect(contrastRatio(t.focus, t.surface, t.canvas)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });
}

checkTheme("light", light);
checkTheme("dark", dark);

describe("palette sanity", () => {
  it("brand primary is the design's #2F5D3A", () => {
    expect(palette.green600.toLowerCase()).toBe("#2f5d3a");
  });
});
