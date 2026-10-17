import { base64ToBytes, relayOcrSchema } from "@voya/core";
import { bearerUser, relayJson } from "@/lib/bearer";
import { ocr } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** JPEG, PNG, WebP, GIF or HEIC/HEIF, by magic bytes (the app sends raw bytes, no MIME type). */
function isImage(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return true; // PNG
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return true; // WebP
  if (ascii(0, 3) === "GIF") return true; // GIF
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1|heif)$/.test(ascii(8, 12))) return true; // HEIC / HEIF
  return false;
}

/**
 * Mobile relay for reading text in a photo (menus, receipts), so the Google Vision key stays on
 * the server. The photo is decoded in memory, checked, sent to the provider once and dropped:
 * it is never written to disk, storage or logs.
 */
export async function POST(request: Request) {
  const user = await bearerUser(request);
  if (!user) return relayJson({ error: "Sign in to read photos." }, 401);
  const body = await request.json().catch(() => null);
  const parsed = relayOcrSchema.safeParse(body);
  if (!parsed.success) return relayJson({ error: "Choose a photo first." }, 400);
  let bytes: Uint8Array;
  try { bytes = base64ToBytes(parsed.data.image); } catch { return relayJson({ error: "That photo couldn't be read." }, 400); }
  if (bytes.length > MAX_IMAGE_BYTES) return relayJson({ error: "Photos up to 8 MB, please." }, 413);
  if (!isImage(bytes)) return relayJson({ error: "That file isn't a photo we can read (JPEG, PNG, WebP or HEIC)." }, 415);
  if (!(await checkRateLimit("ocr", user.id, 20))) return relayJson({ error: "Too many photos at once. Give it a moment." }, 429);
  try {
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const lines = await ocr.recognize(buf, { languageHints: parsed.data.languageHints, document: parsed.data.document });
    return relayJson({ lines });
  } catch {
    return relayJson({ error: "Couldn't read that photo. Try a sharper one with more light." }, 502);
  }
}
