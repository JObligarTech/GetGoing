import { isDemo } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, mode: isDemo ? "demo" : "supabase" }, { headers: { "Cache-Control": "no-store" } });
}
