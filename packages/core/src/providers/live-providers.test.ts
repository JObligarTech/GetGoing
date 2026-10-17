import { describe, expect, it, vi } from "vitest";
import { base64ToBytes, bytesToBase64 } from "./base64";
import { createDeepLTranslation, deeplEndpoint, deeplSource, deeplTarget } from "./deepl";
import { createGoogleVisionOcr, linesFromVision, type VisionResponse } from "./google-vision";
import { createRelayProviders, RelayError } from "./relay";
import { resolveProviders } from "./index";
import { mockGeocode, mockOcr, mockTranslation } from "./mock";
import { translateLines } from "../translate";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("DeepL", () => {
  it("picks the free or pro endpoint from the key and maps language codes", () => {
    expect(deeplEndpoint("abc:fx")).toBe("https://api-free.deepl.com/v2/translate");
    expect(deeplEndpoint("abc")).toBe("https://api.deepl.com/v2/translate");
    expect(deeplTarget("en")).toBe("EN-US");
    expect(deeplTarget("pt")).toBe("PT-PT");
    expect(deeplTarget("zh")).toBe("ZH-HANS");
    expect(deeplTarget("ja")).toBe("JA");
    expect(deeplSource("en-US")).toBe("EN");
  });

  it("sends one batched request with the auth header and returns live translations", async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe("DeepL-Auth-Key k:fx");
      expect(JSON.parse(String(init?.body))).toEqual({ text: ["Where is the station?", "Thank you"], source_lang: "EN", target_lang: "JA" });
      return json({ translations: [{ detected_source_language: "EN", text: "駅はどこですか？" }, { detected_source_language: "EN", text: "ありがとう" }] });
    });
    const p = createDeepLTranslation({ apiKey: "k:fx", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await p.translateMany(["Where is the station?", "Thank you"], "en", "ja")).toEqual([
      { text: "駅はどこですか？", source: "live" },
      { text: "ありがとう", source: "live" },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://api-free.deepl.com/v2/translate");
  });

  it("skips the network for same-language pairs, splits big batches and retries once on 429", async () => {
    const calls: number[] = [];
    let first = true;
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      if (first) { first = false; return json({ message: "Too many requests" }, 429); }
      const texts = JSON.parse(String(init?.body)).text as string[];
      calls.push(texts.length);
      return json({ translations: texts.map((t) => ({ text: t.toUpperCase() })) });
    }) as unknown as typeof fetch;
    const p = createDeepLTranslation({ apiKey: "k", fetchImpl });
    expect(await p.translate("hi", "en", "en-GB")).toEqual({ text: "hi", source: "live" });
    const many = await p.translateMany(Array.from({ length: 120 }, (_, i) => `t${i}`), "en", "fr");
    expect(many).toHaveLength(120);
    expect(many[119]).toEqual({ text: "T119", source: "live" });
    expect(calls).toEqual([50, 50, 20]);
  });

  it("reports quota and server errors instead of inventing a translation", async () => {
    const p = createDeepLTranslation({ apiKey: "k", fetchImpl: (async () => json({}, 456)) as unknown as typeof fetch });
    await expect(p.translate("hi", "en", "ja")).rejects.toThrow("quota");
    expect(() => createDeepLTranslation({ apiKey: "" })).toThrow();
  });
});

/** A Vision response shaped like a real receipt: item and price come back as separate blocks. */
function word(text: string, x0: number, y0: number, x1: number, y1: number, last: "SPACE" | "EOL_SURE_SPACE" | "LINE_BREAK" | null, confidence = 0.97) {
  const chars = [...text];
  return {
    confidence,
    boundingBox: { vertices: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] },
    symbols: chars.map((c, i) => ({ text: c, ...(i === chars.length - 1 && last ? { property: { detectedBreak: { type: last } } } : {}) })),
  };
}
const receipt: VisionResponse = {
  responses: [{
    fullTextAnnotation: {
      pages: [{
        width: 1000, height: 2000,
        blocks: [
          { paragraphs: [{ words: [word("AFURI", 100, 100, 300, 160, "SPACE"), word("原宿", 320, 100, 450, 160, "LINE_BREAK")] }] },
          { paragraphs: [{ words: [word("柚子塩らーめん", 100, 400, 500, 450, "SPACE"), word("×2", 520, 400, 580, 450, "LINE_BREAK"), word("つけ麹", 100, 500, 260, 550, "LINE_BREAK", 0.55)] }] },
          // Prices are their own block on the right, a few px off the item's baseline.
          { paragraphs: [{ words: [word("¥2,400", 800, 404, 950, 452, "LINE_BREAK"), word("¥1,350", 800, 503, 950, 553, "LINE_BREAK")] }] },
        ],
      }],
    },
  }],
};

describe("Google Vision", () => {
  it("rebuilds receipt rows (item and price on one line), keeps low confidence and normalises boxes", () => {
    const lines = linesFromVision(receipt, "receipt");
    expect(lines.map((l) => l.text)).toEqual(["AFURI 原宿", "柚子塩らーめん ×2 ¥2,400", "つけ麹 ¥1,350"]);
    expect(lines[2]!.confidence).toBe(0.55);
    expect(lines[1]!.box).toEqual([0.1, 0.2, 0.85, 0.026]);
  });

  it("on a menu only joins a lone price to the item on its left", () => {
    const lines = linesFromVision(receipt, "menu");
    expect(lines.map((l) => l.text)).toEqual(["AFURI 原宿", "柚子塩らーめん ×2 ¥2,400", "つけ麹 ¥1,350"]);
    const twoColumns: VisionResponse = { responses: [{ fullTextAnnotation: { pages: [{ width: 1000, height: 1000, blocks: [
      { paragraphs: [{ words: [word("餃子", 50, 100, 200, 150, "LINE_BREAK")] }] },
      { paragraphs: [{ words: [word("生ビール", 550, 100, 750, 150, "LINE_BREAK")] }] },
    ] }] } }] };
    expect(linesFromVision(twoColumns, "menu").map((l) => l.text)).toEqual(["餃子", "生ビール"]);
  });

  it("surfaces Vision's own error and sends the key in a header with language hints", async () => {
    expect(() => linesFromVision({ responses: [{ error: { code: 3, message: "Bad image data." } }] })).toThrow("Bad image data.");
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      expect(String(url)).not.toContain("key=");
      expect((init?.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("vk");
      const body = JSON.parse(String(init?.body));
      expect(body.requests[0].features).toEqual([{ type: "DOCUMENT_TEXT_DETECTION" }]);
      expect(body.requests[0].imageContext).toEqual({ languageHints: ["ja"] });
      expect(body.requests[0].image.content).toBe(bytesToBase64(new Uint8Array([0xff, 0xd8, 0xff, 1])));
      return json(receipt);
    });
    const ocr = createGoogleVisionOcr({ apiKey: "vk", fetchImpl: fetchImpl as unknown as typeof fetch });
    const lines = await ocr.recognize(new Uint8Array([0xff, 0xd8, 0xff, 1]).buffer, { languageHints: ["ja-JP"], document: "receipt" });
    expect(lines).toHaveLength(3);
    await expect(ocr.recognize(new ArrayBuffer(0))).rejects.toThrow("Empty image");
  });
});

describe("mobile relay client", () => {
  it("sends the access token, batches translations and posts photos as base64", async () => {
    const seen: { url: string; auth: string; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      seen.push({ url, auth: (init?.headers as Record<string, string>).Authorization!, body });
      if (url.endsWith("/translate")) return json({ translations: (body.texts as string[]).map((t) => ({ text: `[${t}]`, source: "live" })) });
      return json({ lines: [{ text: "餃子 ¥600", confidence: 0.9 }] });
    }) as unknown as typeof fetch;
    const r = createRelayProviders({ baseUrl: "https://getgoing.app/", getAccessToken: async () => "tok", fetchImpl });
    expect(await r.translation.translate("hi", "en", "ja")).toEqual({ text: "[hi]", source: "live" });
    expect(await r.ocr.recognize(new Uint8Array([1, 2, 3]).buffer, { languageHints: ["ja"], document: "receipt" })).toEqual([{ text: "餃子 ¥600", confidence: 0.9 }]);
    expect(seen[0]).toMatchObject({ url: "https://getgoing.app/api/v1/translate", auth: "Bearer tok", body: { texts: ["hi"], from: "en", to: "ja" } });
    expect(seen[1]).toMatchObject({ url: "https://getgoing.app/api/v1/ocr", body: { image: "AQID", languageHints: ["ja"], document: "receipt" } });
  });

  it("refuses without a session and passes the server's error message through", async () => {
    const signedOut = createRelayProviders({ baseUrl: "https://x.test", getAccessToken: async () => null, fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(signedOut.translation.translate("hi", "en", "ja")).rejects.toBeInstanceOf(RelayError);
    const limited = createRelayProviders({ baseUrl: "https://x.test", getAccessToken: async () => "t", fetchImpl: (async () => json({ error: "Too many translations at once. Give it a moment." }, 429)) as unknown as typeof fetch });
    await expect(limited.translation.translate("hi", "en", "ja")).rejects.toMatchObject({ status: 429, message: "Too many translations at once. Give it a moment." });
  });
});

describe("translateLines batching", () => {
  it("uses one batch call when the provider supports it and keeps prices", async () => {
    const translateMany = vi.fn(async (texts: string[]) => texts.map((t) => ({ text: `EN:${t}` })));
    const provider = { translate: vi.fn(), translateMany };
    const out = await translateLines([{ text: "餃子 ¥600", confidence: 0.9 }, { text: "", confidence: 0.9 }, { text: "つけ麺 ¥1,350", confidence: 0.8 }], "ja", "en", provider);
    expect(translateMany).toHaveBeenCalledTimes(1);
    expect(translateMany.mock.calls[0]![0]).toEqual(["餃子", "つけ麺"]);
    expect(provider.translate).not.toHaveBeenCalled();
    expect(out.map((l) => [l.translated, l.price])).toEqual([["EN:餃子", 600], ["", null], ["EN:つけ麺", 1350]]);
  });
});

describe("base64", () => {
  it("round-trips and rejects junk", () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(() => base64ToBytes("not base64!")).toThrow();
  });
});

describe("resolveProviders", () => {
  it("stays on the mocks in demo mode and tests", () => {
    const p = resolveProviders({ DEEPL_API_KEY: "k", GOOGLE_VISION_API_KEY: "v" });
    expect(p.names).toEqual({ routing: "mock", geocode: "mock", fx: "mock", translation: "mock", ocr: "mock" });
    expect(p.translation).toBe(mockTranslation);
    expect(p.geocode).toBe(mockGeocode);
  });
  it("goes live on a real deployment, keyless services always and DeepL / Vision when keyed", () => {
    expect(resolveProviders({ live: true }).names).toEqual({ routing: "osrm", geocode: "nominatim", fx: "frankfurter", translation: "mock", ocr: "mock" });
    const p = resolveProviders({ live: true, DEEPL_API_KEY: "k:fx", GOOGLE_VISION_API_KEY: "v" });
    expect(p.names).toMatchObject({ translation: "deepl", ocr: "google-vision" });
    expect(p.ocr).not.toBe(mockOcr);
  });
  it("lets an explicit provider win and refuses a keyed provider without its key", () => {
    expect(resolveProviders({ live: true, FX_PROVIDER: "mock", DEEPL_API_KEY: "k" }).names).toMatchObject({ fx: "mock", translation: "deepl" });
    expect(() => resolveProviders({ TRANSLATION_PROVIDER: "deepl" })).toThrow("DEEPL_API_KEY");
  });
});
