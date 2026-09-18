/**
 * Voya design tokens — single source of truth for web (CSS variables via
 * tokens.css) and native (theme object). Values are lifted from the Claude
 * Design mockups (green system, Manrope).
 */

export const palette = {
  green900: "#0F1A13",
  green700: "#1F4529",
  green600: "#2F5D3A",
  green300: "#7DBA8E",
  green100: "#E6EFE8",
  ink: "#1B211C",
  inkDark: "#121614",
  inkSurface: "#1B211D",
  paper: "#F6F5F1",
  white: "#FFFFFF",
  offWhite: "#F1F3EF",
  mist: "#C9D3CC",
  // Mockup used #6B7570 (4.37:1 on paper) — darkened one step to clear WCAG AA 4.5:1.
  slate500: "#5F6964",
  slate400: "#9AA79E",
  slate300: "#98A39C",
  slate600: "#5E6A63",
  saffron: "#F2B233",
  saffronDeep: "#C98A2B",
  saffronText: "#7A5200",
  saffronBg: "#FFF4D6",
  amber: "#E0A020",
  tangerine: "#E0703A",
  rose: "#C9516F",
  indigo: "#5568C9",
  danger: "#B0335F",
} as const;

export type ThemeName = "light" | "dark";

export interface ColorTheme {
  canvas: string;
  surface: string;
  surfaceRaised: string; // translucent overlay cards over maps
  surfaceTint: string; // green tinted surface (active rows, icon coins)
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderStrong: string;
  primary: string;
  onPrimary: string;
  primaryHover: string;
  primarySoft: string;
  /** text on surfaceTint (chips, hints, active nav) — stays ≥4.5:1 even on tint-over-tint */
  onTint: string;
  /** high-contrast "ink" button (dark on light, light on dark) */
  ink: string;
  onInk: string;
  premium: string;
  premiumText: string;
  premiumBg: string;
  danger: string;
  focus: string;
  mapBg: string;
  shadow: string;
}

export const light: ColorTheme = {
  canvas: palette.paper,
  surface: palette.white,
  surfaceRaised: "rgba(255,255,255,0.94)",
  surfaceTint: palette.green100,
  text: palette.ink,
  textMuted: palette.slate500,
  textFaint: palette.slate400,
  border: "rgba(20,30,20,0.08)",
  borderStrong: "rgba(20,30,20,0.12)",
  primary: palette.green600,
  onPrimary: palette.white,
  primaryHover: palette.green700,
  primarySoft: palette.green100,
  onTint: palette.green600,
  ink: palette.ink,
  onInk: palette.white,
  premium: palette.saffron,
  premiumText: palette.saffronText,
  premiumBg: palette.saffronBg,
  danger: palette.danger,
  focus: palette.green600,
  mapBg: "#E9ECE6",
  shadow: "0 2px 10px rgba(0,0,0,0.08)",
};

export const dark: ColorTheme = {
  canvas: palette.inkDark,
  surface: palette.inkSurface,
  surfaceRaised: "rgba(27,33,29,0.94)",
  surfaceTint: "rgba(125,186,142,0.16)",
  text: palette.offWhite,
  textMuted: palette.slate300,
  textFaint: palette.slate600,
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.14)",
  primary: palette.green300,
  onPrimary: palette.green900,
  primaryHover: "#93CBA3",
  primarySoft: "rgba(125,186,142,0.16)",
  onTint: "#A6D8B4",
  ink: palette.offWhite,
  onInk: palette.inkDark,
  premium: palette.saffron,
  premiumText: palette.saffron,
  premiumBg: "rgba(242,178,51,0.14)",
  danger: "#F58FB4",
  focus: palette.green300,
  mapBg: "#1B1F1C",
  shadow: "0 2px 10px rgba(0,0,0,0.4)",
};

export const themes: Record<ThemeName, ColorTheme> = { light, dark };

/** Category colours — used for pins, dots and lettered tiles. */
export const categoryColors = {
  coffee: palette.amber,
  food: palette.tangerine,
  sights: palette.green600,
  must: palette.green600,
  shops: palette.indigo,
  nightlife: palette.rose,
  stay: palette.green300,
  unscheduled: palette.slate400,
} as const;
export type CategoryKey = keyof typeof categoryColors;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  "2xl": 16,
  "3xl": 18,
  pill: 999,
} as const;

export const spacing = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 14, 5: 16, 6: 20, 7: 24, 8: 28, 9: 32, 10: 44,
} as const;

export const fontFamily = {
  sans: "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, Menlo, monospace",
} as const;

export const fontSize = {
  "2xs": 10.5,
  xs: 11,
  sm: 12,
  smd: 12.5,
  base: 13,
  md: 14,
  lg: 15,
  xl: 16,
  "2xl": 20,
  "3xl": 26,
  "4xl": 30,
  "5xl": 34,
  display: 48,
  hero: 64,
} as const;

export const fontWeight = { medium: 500, semibold: 600, bold: 700, extrabold: 800 } as const;

/** Control heights — 44px minimum touch target, 52px primary CTA. */
export const control = { touch: 44, cta: 52, chip: 26, tile: 52, tabBar: 84, sidebar: 220 } as const;

/** Motion — kept restrained. Web uses these as ms; native as ms too. */
export const motion = {
  duration: { fast: 120, base: 180, slow: 260 },
  easing: { standard: "cubic-bezier(.2,.8,.2,1)", out: "cubic-bezier(0,0,.2,1)" },
  pressScale: 0.97,
} as const;

export const tokens = {
  palette, themes, light, dark, categoryColors, radius, spacing,
  fontFamily, fontSize, fontWeight, control, motion,
} as const;

export default tokens;
