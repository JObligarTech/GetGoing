/** WCAG 2.x relative luminance + contrast ratio. Supports #rgb/#rrggbb and rgba() over a base. */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function parseColor(c: string): [number, number, number, number] {
  if (c.startsWith("#")) return [...hexToRgb(c), 1];
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unsupported colour: ${c}`);
  const parts = m[1]!.split(",").map((p) => parseFloat(p.trim()));
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

/** Flatten a possibly-translucent colour onto an opaque background. */
export function composite(fg: string, bg: string): [number, number, number] {
  const [r, g, b, a] = parseColor(fg);
  const [br, bg_, bb] = parseColor(bg);
  return [
    Math.round(r * a + br * (1 - a)),
    Math.round(g * a + bg_ * (1 - a)),
    Math.round(b * a + bb * (1 - a)),
  ];
}

export function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** `base` is the opaque page colour translucent layers sit on (theme canvas). */
export function contrastRatio(fg: string, bg: string, base = "#ffffff"): number {
  const bgRgb = composite(bg, base);
  const fgRgb = composite(fg, `rgb(${bgRgb.join(",")})`);
  const l1 = luminance(fgRgb);
  const l2 = luminance(bgRgb);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
