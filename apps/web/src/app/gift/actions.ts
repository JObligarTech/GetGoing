"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { giftCodeSchema } from "@voya/core";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export interface GiftPreview { trip_name: string; trip_tz: string | null; trip_end: string | null; days: number; status: string; giver_name: string; traveler_name: string; expired: boolean; ends_preview: string }

/** What the gift link shows before sign-in. Public, rate-limited per IP; the code is the only key. */
export async function giftPreviewAction(raw: unknown): Promise<GiftPreview | null> {
  const code = giftCodeSchema.safeParse(raw);
  if (!code.success) return null;
  if (!(await checkRateLimit("gift-view", "", 60))) return null;
  if (isDemo) return demoStore.giftPreview(code.data);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("gift_preview", { p_code: code.data });
  return error || !data ? null : (data as unknown as GiftPreview);
}

/** Accept: needs a signed-in user; the database links the traveler, adds membership and inserts the entitlement in one call. */
export async function acceptGiftAction(formData: FormData) {
  const code = giftCodeSchema.safeParse(formData.get("code"));
  if (!code.success) redirect("/home");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/gift/${code.data}`)}` as "/login");
  if (!(await checkRateLimit("gift-accept", user.id, 30))) redirect(`/gift/${code.data}?error=rate` as Route);
  let id: string | null = null;
  if (isDemo) {
    const r = await demoStore.redeemGift(code.data, user.id);
    if ("error" in r) redirect(`/gift/${code.data}?error=${encodeURIComponent(r.error)}` as Route);
    id = r.entitlement.id;
  } else {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc("redeem_gift", { p_code: code.data });
    if (error) redirect(`/gift/${code.data}?error=${encodeURIComponent(error.code === "42501" ? "This gift is for someone else." : "This gift is no longer available.")}` as Route);
    id = (data as { entitlement_id?: string } | null)?.entitlement_id ?? null;
  }
  revalidatePath("/", "layout");
  redirect(`/pass/done?e=${id}` as Route);
}
