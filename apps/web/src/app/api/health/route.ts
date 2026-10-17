import { isDemo } from "@/lib/env";
import { providerNames } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Liveness plus which adapter each service resolved to ("deepl" or "mock", never a key), to check a deployment's setup. */
export function GET() {
  return Response.json({ ok: true, mode: isDemo ? "demo" : "supabase", providers: providerNames }, { headers: { "Cache-Control": "no-store" } });
}
