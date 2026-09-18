import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@voya/core/db";
import { publicEnv } from "@/lib/env";

/** Server Components / Server Actions / Route Handlers. Uses the caller's cookies → RLS applies. */
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }));
        } catch {
          // Called from a Server Component: cookies are read-only there; proxy.ts handles refresh.
        }
      },
    },
  });
}
