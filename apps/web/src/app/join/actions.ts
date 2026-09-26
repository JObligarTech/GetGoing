"use server";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

const token = z.string().regex(/^[a-z0-9]{24,64}$/);
export interface InvitePreview { trip_name: string; inviter: string; traveler: string | null; expires_at: string; accepted: boolean }

/** What a link shows before sign-in. Public, rate-limited per IP. */
export async function invitePreviewAction(raw: unknown): Promise<InvitePreview | null> {
  const t = token.safeParse(raw);
  if (!t.success) return null;
  if (!(await checkRateLimit("invite-view", "", 60))) return null;
  if (isDemo) return demoStore.invitePreview(t.data);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("invite_preview", { p_token: t.data });
  return error || !data ? null : (data as unknown as InvitePreview);
}

/** Accept: needs a signed-in user; the database adds the membership and links the guest row. */
export async function acceptInviteAction(formData: FormData) {
  const t = token.safeParse(formData.get("token"));
  if (!t.success) redirect("/home");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${t.data}`)}` as "/login");
  if (isDemo) redirect("/home"); // the demo account already belongs to every demo trip
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("accept_trip_invite", { p_token: t.data });
  if (error || !data) redirect(`/join/${t.data}?error=1` as Route);
  redirect(`/trips/${data}` as "/trips");
}
