"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@voya/core/db";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser client (anon key only). Only needed for realtime/OAuth redirects; data goes through server actions. */
export function getBrowserSupabase() {
  client ??= createBrowserClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
