/**
 * Translation and OCR for the mobile app, relayed through the web server so provider keys never
 * ship in the app bundle. Each call carries the user's Supabase access token; the server checks it,
 * rate-limits per user and calls DeepL / Google Vision. Contract: apps/web/src/app/api/v1/*.
 */
import type { OcrLine, OcrProvider, Translation, TranslationProvider } from "./types";
import { bytesToBase64 } from "./base64";

export class RelayError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function createRelayProviders(opts: { baseUrl: string; getAccessToken: () => Promise<string | null>; fetchImpl?: typeof fetch }): { translation: TranslationProvider; ocr: OcrProvider } {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const f = opts.fetchImpl ?? fetch;

  async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const token = await opts.getAccessToken();
    if (!token) throw new RelayError("Sign in to translate.", 401);
    const res = await f(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !json) throw new RelayError(json?.error ?? `Request failed (${res.status})`, res.status);
    return json;
  }

  const translation: TranslationProvider = {
    async translate(text, from, to, o) {
      const [t] = await translation.translateMany!([text], from, to, o);
      return t!;
    },
    async translateMany(texts, from, to, o) {
      const out: Translation[] = [];
      for (let i = 0; i < texts.length; i += 60) {
        const r = await post<{ translations: Translation[] }>("/api/v1/translate", { texts: texts.slice(i, i + 60), from, to }, o?.signal);
        out.push(...r.translations);
      }
      return out;
    },
  };

  const ocr: OcrProvider = {
    async recognize(image, o) {
      const buf = image instanceof ArrayBuffer ? image : await image.arrayBuffer();
      const r = await post<{ lines: OcrLine[] }>("/api/v1/ocr", { image: bytesToBase64(new Uint8Array(buf)), languageHints: o?.languageHints ?? [], document: o?.document }, o?.signal);
      return r.lines;
    },
  };

  return { translation, ocr };
}
