import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEMO_USER_ID, demoProfile, type Profile } from "@voya/core";
import { DEMO_COOKIE, isDemo } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile;
}

/** The signed-in user + profile, memoised per request. Null when signed out. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (isDemo) {
    const store = await cookies();
    if (store.get(DEMO_COOKIE)?.value !== "1") return null;
    return { id: DEMO_USER_ID, email: "joe@example.com", profile: demoProfile };
  }
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) return null;
  return { id: data.user.id, email: data.user.email ?? null, profile };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("Unauthenticated"); // proxy.ts redirects before we get here; this is defence in depth
  return u;
}
