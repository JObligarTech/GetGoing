"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { languageByCode, phraseSchema, translateLines, translateSchema, type CameraLine, type Phrase, type Translation } from "@voya/core";
import { getTripBundle } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { ocr, translation } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

type Result<T> = T | { error: string };

/** One translation. Rate-limited per user so auto-translate while typing can't drain a provider quota. */
export async function translateAction(input: unknown): Promise<Result<Translation>> {
  const user = await requireUser();
  const parsed = translateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the text." };
  if (!languageByCode(parsed.data.from) || !languageByCode(parsed.data.to)) return { error: "Unsupported language." };
  if (!(await checkRateLimit("translate", user.id, 60))) return { error: "Too many translations at once. Give it a moment." };
  try {
    return await translation.translate(parsed.data.text, parsed.data.from, parsed.data.to);
  } catch {
    return { error: "Translation is unavailable right now." };
  }
}

/** Save a phrase to the trip so every traveler has it. */
export async function savePhraseAction(input: unknown): Promise<Result<Phrase>> {
  const user = await requireUser();
  const parsed = phraseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the phrase." };
  const bundle = await getTripBundle(parsed.data.tripId);
  if (!bundle) return { error: "Trip not found." };
  if (bundle.phrases.some((p) => p.source_text === parsed.data.sourceText && p.target_lang === parsed.data.targetLang)) return { error: "That phrase is already saved." };
  let row: Phrase | null;
  if (isDemo) {
    row = await demoStore.addPhrase(parsed.data, user.id);
  } else {
    const db = await createServerSupabase();
    const id = crypto.randomUUID();
    const values = { id, trip_id: parsed.data.tripId, source_text: parsed.data.sourceText, source_lang: parsed.data.sourceLang, target_text: parsed.data.targetText, target_lang: parsed.data.targetLang, romanized: parsed.data.romanized, sort_order: bundle.phrases.length, created_by: user.id };
    const { error } = await db.from("phrases").insert(values);
    row = error ? null : { ...values, created_at: new Date().toISOString() };
  }
  if (!row) return { error: "Couldn't save the phrase." };
  revalidatePath("/translate");
  return row;
}

export async function removePhraseAction(tripId: unknown, phraseId: unknown): Promise<Result<{ ok: true }>> {
  await requireUser();
  const ids = z.object({ tripId: z.uuid(), phraseId: z.uuid() }).safeParse({ tripId, phraseId });
  if (!ids.success) return { error: "Phrase not found." };
  let ok: boolean;
  if (isDemo) ok = await demoStore.removePhrase(ids.data.tripId, ids.data.phraseId);
  else {
    const db = await createServerSupabase();
    const { error, count } = await db.from("phrases").delete({ count: "exact" }).eq("id", ids.data.phraseId).eq("trip_id", ids.data.tripId);
    ok = !error && (count ?? 0) > 0;
  }
  if (!ok) return { error: "Couldn't remove the phrase." };
  revalidatePath("/translate");
  return { ok: true };
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Camera translation: the photo is read into memory, sent to the OCR provider and dropped.
 * It is never written to disk or storage. `from` is the trip's language, `to` the traveler's.
 */
export async function recognizeAction(formData: FormData): Promise<Result<{ lines: CameraLine[]; from: string; to: string }>> {
  const user = await requireUser();
  const langs = z.object({ from: z.string().max(16), to: z.string().max(16) }).safeParse({ from: formData.get("from"), to: formData.get("to") });
  if (!langs.success || !languageByCode(langs.data.from) || !languageByCode(langs.data.to)) return { error: "Unsupported language." };
  const file = formData.get("image");
  const sample = formData.get("sample") === "1";
  if (!sample) {
    if (!(file instanceof File)) return { error: "Choose a photo first." };
    if (!IMAGE_TYPES.has(file.type)) return { error: "That file isn't a photo we can read (JPEG, PNG, WebP or HEIC)." };
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return { error: "Photos up to 8 MB, please." };
  }
  if (!(await checkRateLimit("ocr", user.id, 20))) return { error: "Too many photos at once. Give it a moment." };
  try {
    const bytes = sample ? new ArrayBuffer(0) : await (file as File).arrayBuffer();
    const raw = await ocr.recognize(bytes, { languageHints: [langs.data.from] });
    const lines = await translateLines(raw, langs.data.from, langs.data.to, translation);
    return { lines, from: langs.data.from, to: langs.data.to };
  } catch {
    return { error: "Couldn't read that photo. Try a sharper one with more light." };
  }
}
