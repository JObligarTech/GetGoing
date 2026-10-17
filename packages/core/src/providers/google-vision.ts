/**
 * Google Cloud Vision OCR (DOCUMENT_TEXT_DETECTION). Server-side only: the API key must never
 * reach a browser or the app bundle. The photo is sent once and dropped; nothing is stored.
 * Docs: https://cloud.google.com/vision/docs/fulltext-annotations
 *
 * Vision returns blocks → paragraphs → words → symbols. Receipts and menus put the item on the
 * left and the price on the right, which Vision often reports as separate blocks, so lines are
 * rebuilt into visual rows: a receipt row becomes one line ("柚子塩らーめん ×2 ¥2,400"), and on a
 * menu a lone price joins the item to its left. Boxes are [x, y, w, h] as fractions of the image.
 */
import type { OcrLine, OcrProvider } from "./types";
import { bytesToBase64 } from "./base64";

interface Vertex { x?: number; y?: number }
interface Symbol { text: string; property?: { detectedBreak?: { type?: string } } }
interface Word { boundingBox?: { vertices?: Vertex[] }; confidence?: number; symbols?: Symbol[] }
interface Page { width?: number; height?: number; blocks?: { paragraphs?: { words?: Word[] }[] }[] }
export interface VisionResponse { responses?: { fullTextAnnotation?: { pages?: Page[] }; error?: { code?: number; message?: string } }[] }

interface Fragment { text: string; x0: number; y0: number; x1: number; y1: number; confidence: number }

const LINE_END = new Set(["EOL_SURE_SPACE", "LINE_BREAK", "HYPHEN"]);
const SPACE = new Set(["SPACE", "SURE_SPACE"]);
const PRICE_ONLY = /^(?:[¥￥€£$₩]\s*)?\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?\s*(?:円|원)?$/u;

/** Words → line fragments, following Vision's own line breaks. */
export function fragmentsFromPage(page: Page): Fragment[] {
  const out: Fragment[] = [];
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      let text = "", words: Word[] = [];
      const flush = () => {
        const t = text.trim();
        if (t && words.length) out.push(toFragment(t, words));
        text = ""; words = [];
      };
      for (const word of para.words ?? []) {
        words.push(word);
        for (const s of word.symbols ?? []) {
          text += s.text;
          const br = s.property?.detectedBreak?.type;
          if (br && SPACE.has(br)) text += " ";
          else if (br && LINE_END.has(br)) { if (br === "EOL_SURE_SPACE" || br === "LINE_BREAK") flush(); else { text += "-"; flush(); } }
        }
      }
      flush();
    }
  }
  return out;
}

function toFragment(text: string, words: Word[]): Fragment {
  const vs = words.flatMap((w) => w.boundingBox?.vertices ?? []);
  const xs = vs.map((v) => v.x ?? 0), ys = vs.map((v) => v.y ?? 0);
  const confs = words.map((w) => w.confidence).filter((c): c is number => typeof c === "number");
  return {
    text,
    x0: xs.length ? Math.min(...xs) : 0, x1: xs.length ? Math.max(...xs) : 0,
    y0: ys.length ? Math.min(...ys) : 0, y1: ys.length ? Math.max(...ys) : 0,
    confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.8,
  };
}

/** Group fragments into visual rows (vertical centres within half a line height), top to bottom, left to right. */
function rows(frags: Fragment[]): Fragment[][] {
  const heights = frags.map((f) => f.y1 - f.y0).filter((h) => h > 0).sort((a, b) => a - b);
  const lineH = heights.length ? heights[Math.floor(heights.length / 2)]! : 10;
  const sorted = [...frags].sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const out: Fragment[][] = [];
  for (const f of sorted) {
    const c = (f.y0 + f.y1) / 2;
    const row = out[out.length - 1];
    const rc = row ? row.reduce((s, r) => s + (r.y0 + r.y1) / 2, 0) / row.length : NaN;
    if (row && Math.abs(c - rc) <= lineH * 0.5) row.push(f);
    else out.push([f]);
  }
  return out.map((r) => r.sort((a, b) => a.x0 - b.x0));
}

function merge(parts: Fragment[]): Fragment {
  return {
    text: parts.map((p) => p.text).join(" "),
    x0: Math.min(...parts.map((p) => p.x0)), x1: Math.max(...parts.map((p) => p.x1)),
    y0: Math.min(...parts.map((p) => p.y0)), y1: Math.max(...parts.map((p) => p.y1)),
    confidence: Math.min(...parts.map((p) => p.confidence)),
  };
}

/** Rebuild lines for the document type, then normalise boxes to fractions of the page. */
export function linesFromVision(json: VisionResponse, document?: "menu" | "receipt"): OcrLine[] {
  const r = json.responses?.[0];
  if (r?.error) throw new Error(`Vision ${r.error.code ?? ""} ${r.error.message ?? ""}`.trim());
  const out: OcrLine[] = [];
  for (const page of r?.fullTextAnnotation?.pages ?? []) {
    const frags = fragmentsFromPage(page);
    if (!frags.length) continue;
    const W = page.width || Math.max(...frags.map((f) => f.x1), 1);
    const H = page.height || Math.max(...frags.map((f) => f.y1), 1);
    const lines: Fragment[] = [];
    for (const row of rows(frags)) {
      if (document === "receipt") { lines.push(merge(row)); continue; }
      // Menus can have columns: only a lone price joins the item to its left.
      for (const f of row) {
        const prev = lines[lines.length - 1];
        if (PRICE_ONLY.test(f.text) && prev && row.includes(prev)) lines[lines.length - 1] = merge([prev, f]);
        else lines.push(f);
      }
    }
    for (const l of lines) {
      const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
      out.push({ text: l.text, confidence: Math.round(l.confidence * 100) / 100, box: [round(l.x0 / W), round(l.y0 / H), round((l.x1 - l.x0) / W), round((l.y1 - l.y0) / H)] });
    }
  }
  return out;
}

export function createGoogleVisionOcr(opts: { apiKey: string; endpoint?: string; fetchImpl?: typeof fetch }): OcrProvider {
  if (!opts.apiKey) throw new Error("GOOGLE_VISION_API_KEY is not set");
  const endpoint = opts.endpoint ?? "https://vision.googleapis.com/v1/images:annotate";
  const f = opts.fetchImpl ?? fetch;
  return {
    async recognize(image, o) {
      const buf = image instanceof ArrayBuffer ? image : await image.arrayBuffer();
      if (!buf.byteLength) throw new Error("Empty image");
      const languageHints = (o?.languageHints ?? []).map((l) => l.toLowerCase().split("-")[0]!).filter(Boolean);
      const body = JSON.stringify({
        requests: [{
          image: { content: bytesToBase64(new Uint8Array(buf)) },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          ...(languageHints.length ? { imageContext: { languageHints } } : {}),
        }],
      });
      // The key goes in a header, not the URL, so it never lands in access logs.
      const res = await f(endpoint, { method: "POST", headers: { "X-Goog-Api-Key": opts.apiKey, "Content-Type": "application/json" }, body, signal: o?.signal });
      if (!res.ok) throw new Error(`Vision ${res.status}`);
      return linesFromVision((await res.json()) as VisionResponse, o?.document);
    },
  };
}
