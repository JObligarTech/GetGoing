import { languageByCode, relayTranslateSchema } from "@voya/core";
import { bearerUser, relayJson } from "@/lib/bearer";
import { translation } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Mobile relay for translation, so the DeepL key stays on the server.
 * Same checks as the web's translateAction: a verified session, zod-validated input,
 * supported languages only, and a per-user rate limit (one batch counts as one call).
 */
export async function POST(request: Request) {
  const user = await bearerUser(request);
  if (!user) return relayJson({ error: "Sign in to translate." }, 401);
  const body = await request.json().catch(() => null);
  const parsed = relayTranslateSchema.safeParse(body);
  if (!parsed.success) return relayJson({ error: parsed.error.issues[0]?.message ?? "Check the text." }, 400);
  const { texts, from, to } = parsed.data;
  if (!languageByCode(from) || !languageByCode(to)) return relayJson({ error: "Unsupported language." }, 400);
  if (!(await checkRateLimit("translate", user.id, 60))) return relayJson({ error: "Too many translations at once. Give it a moment." }, 429);
  try {
    const translations = translation.translateMany
      ? await translation.translateMany(texts, from, to)
      : await Promise.all(texts.map((t) => translation.translate(t, from, to)));
    return relayJson({ translations });
  } catch {
    return relayJson({ error: "Translation is unavailable right now." }, 502);
  }
}
