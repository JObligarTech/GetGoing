/**
 * DeepL text translation. Server-side only: the key must never reach a browser or the app bundle.
 * Free-plan keys end in ":fx" and use api-free.deepl.com; everything else uses api.deepl.com.
 * Docs: https://developers.deepl.com/docs/api-reference/translate
 */
import type { Translation, TranslationProvider } from "./types";

/** DeepL needs a regional variant for a few target languages; sources always take the base code. */
const TARGET_VARIANT: Record<string, string> = { en: "EN-US", pt: "PT-PT", zh: "ZH-HANS" };

export const deeplTarget = (code: string) => TARGET_VARIANT[base(code)] ?? base(code).toUpperCase();
export const deeplSource = (code: string) => base(code).toUpperCase();
function base(code: string) { return code.toLowerCase().split("-")[0]!; }

export function deeplEndpoint(apiKey: string): string {
  return apiKey.trim().endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
}

/** DeepL accepts up to 50 texts per request. */
const MAX_TEXTS = 50;

export interface DeepLProvider extends TranslationProvider {
  translateMany(texts: string[], from: string, to: string, opts?: { signal?: AbortSignal }): Promise<Translation[]>;
}

export function createDeepLTranslation(opts: { apiKey: string; endpoint?: string; fetchImpl?: typeof fetch }): DeepLProvider {
  if (!opts.apiKey) throw new Error("DEEPL_API_KEY is not set");
  const endpoint = opts.endpoint ?? deeplEndpoint(opts.apiKey);
  const f = opts.fetchImpl ?? fetch;

  async function call(texts: string[], from: string, to: string, signal?: AbortSignal): Promise<string[]> {
    const body = JSON.stringify({ text: texts, source_lang: deeplSource(from), target_lang: deeplTarget(to) });
    const init: RequestInit = { method: "POST", headers: { Authorization: `DeepL-Auth-Key ${opts.apiKey}`, "Content-Type": "application/json" }, body, signal };
    let res = await f(endpoint, init);
    // 429 = too many requests, 503 = temporarily unavailable: one short retry, then give up.
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 600));
      res = await f(endpoint, init);
    }
    if (!res.ok) throw new Error(res.status === 456 ? "DeepL quota exceeded" : `DeepL ${res.status}`);
    const json = (await res.json()) as { translations?: { text: string }[] };
    const out = json.translations?.map((t) => t.text) ?? [];
    if (out.length !== texts.length) throw new Error("DeepL returned an unexpected response");
    return out;
  }

  const provider: DeepLProvider = {
    async translate(text, from, to, o) {
      const [r] = await provider.translateMany([text], from, to, o);
      return r!;
    },
    async translateMany(texts, from, to, o) {
      if (base(from) === base(to)) return texts.map((text) => ({ text, source: "live" as const }));
      const out: Translation[] = [];
      for (let i = 0; i < texts.length; i += MAX_TEXTS) {
        const chunk = texts.slice(i, i + MAX_TEXTS);
        const done = await call(chunk, from, to, o?.signal);
        out.push(...done.map((text) => ({ text, source: "live" as const })));
      }
      return out;
    },
  };
  return provider;
}
