import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { demoUsers, type Profile } from "@voya/core";
import { demoStore } from "@/lib/demo-store";
import { DEMO_COOKIE, isDemo } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** The demo cookie names the demo account: "1" is Joe (legacy value), otherwise the user id of a seeded demo user. */
export function demoUserFromCookie(value: string | undefined) {
  if (!value) return null;
  return demoUsers.find((u) => (value === "1" ? u.email === "joe@example.com" : u.id === value)) ?? null;
}

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile;
}

/** The signed-in user + profile, memoised per request. Null when signed out. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (isDemo) {
    const store = await cookies();
    const u = demoUserFromCookie(store.get(DEMO_COOKIE)?.value);
    if (!u) return null;
    return { id: u.id, email: u.email, profile: (await demoStore.profile(u.id)) ?? u.profile };
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
