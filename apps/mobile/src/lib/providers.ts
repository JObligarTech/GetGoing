import { createFrankfurterFx, createFxCache, mockFx, mockOcr, mockTranslation, type FxRate } from "@voya/core";
import { prefs } from "./supabase";

/**
 * Translation, OCR and FX on the device. Keyed providers must never ship in the app
 * bundle, so translation and OCR stay on the deterministic mocks here until a server
 * relay exists (the web app already routes them through server actions). Frankfurter
 * is keyless, so FX can go live with EXPO_PUBLIC_FX_PROVIDER=frankfurter.
 */
export const translation = mockTranslation;
export const ocr = mockOcr;

const fxProvider = process.env.EXPO_PUBLIC_FX_PROVIDER === "frankfurter" ? createFrankfurterFx() : mockFx;
/** Rates are cached in memory for an hour and persisted per pair so the converter works offline. */
export const fx = createFxCache(fxProvider, {
  ttlMs: 60 * 60 * 1000,
  store: {
    async load(key) { try { const raw = await prefs.get(`fx.${key}`); return raw ? (JSON.parse(raw) as FxRate) : null; } catch { return null; } },
    async save(key, rate) { try { await prefs.set(`fx.${key}`, JSON.stringify(rate)); } catch { /* storage unavailable */ } },
  },
});
