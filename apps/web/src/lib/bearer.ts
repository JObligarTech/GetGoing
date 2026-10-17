import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@voya/core/db";
import { isDemo, publicEnv } from "@/lib/env";

/**
 * The signed-in user behind a mobile request (`Authorization: Bearer <Supabase access token>`).
 * The token is verified by Supabase Auth (`getUser`), not just decoded, so an expired, revoked or
 * forged token is refused. Returns null when there's no valid token. Demo mode has no relay:
 * the mobile demo runs its mocks on the device.
 */
export async function bearerUser(request: Request): Promise<{ id: string } | null> {
  if (isDemo) return null;
  const header = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(header);
  if (!m) return null;
  const supabase = createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(m[1]);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

/** JSON reply for the /api/v1 relay: never cached, never framed. */
export function relayJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
