import { createFrankfurterFx, createFxCache, createRelayProviders, mockFx, mockOcr, mockTranslation, type FxRate, type OcrProvider, type TranslationProvider } from "@voya/core";
import { getSupabase, isDemo, prefs } from "./supabase";

/**
 * Translation, OCR and FX on the device.
 *
 * Keyed providers must never ship in the app bundle, so translation (DeepL) and photo reading
 * (Google Vision) go through the web server's relay (/api/v1/translate, /api/v1/ocr) with the
 * user's Supabase access token. Demo mode (no Supabase configured) and Expo Go previews keep the
 * deterministic on-device mocks. Frankfurter is keyless, so a real build calls it directly.
 */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "";
const useRelay = !isDemo && /^https?:\/\//.test(SITE_URL);

async function accessToken(): Promise<string | null> {
  const { data } = await (await getSupabase()).auth.getSession();
  return data.session?.access_token ?? null;
}

const relay = useRelay ? createRelayProviders({ baseUrl: SITE_URL, getAccessToken: accessToken }) : null;

export const translation: TranslationProvider = relay?.translation ?? mockTranslation;
export const ocr: OcrProvider = relay?.ocr ?? mockOcr;

const fxName = process.env.EXPO_PUBLIC_FX_PROVIDER || (isDemo ? "mock" : "frankfurter");
const fxProvider = fxName === "frankfurter" ? createFrankfurterFx() : mockFx;
/** Rates are cached in memory for an hour and persisted per pair so the converter works offline. */
export const fx = createFxCache(fxProvider, {
  ttlMs: 60 * 60 * 1000,
  store: {
    async load(key) { try { const raw = await prefs.get(`fx.${key}`); return raw ? (JSON.parse(raw) as FxRate) : null; } catch { return null; } },
    async save(key, rate) { try { await prefs.set(`fx.${key}`, JSON.stringify(rate)); } catch { /* storage unavailable */ } },
  },
});
