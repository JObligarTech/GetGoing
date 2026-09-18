import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@voya/core/db";
import { publicEnv } from "@/lib/env";

/** Supabase client for proxy.ts — mirrors refreshed auth cookies onto the response. */
export function createProxyClient(request: NextRequest, initial: NextResponse) {
  let response = initial;
  const supabase = createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }));
      },
    },
  });
  return { supabase, getResponse: () => response };
}
