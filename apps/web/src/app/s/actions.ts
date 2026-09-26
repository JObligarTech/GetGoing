"use server";
import { z } from "zod";
import type { ClaimView } from "@voya/core";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";

const token = z.string().regex(/^[a-z0-9]{24,64}$/);

/** Public, no account: the token is the only credential. Rate-limited per IP. */
export async function claimViewAction(raw: unknown): Promise<ClaimView | null> {
  const t = token.safeParse(raw);
  if (!t.success) return null;
  if (!(await checkRateLimit("claim-view", "", 60))) return null;
  if (isDemo) return demoStore.claimView(t.data);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("bill_claim_view", { p_token: t.data });
  return error || !data ? null : (data as unknown as ClaimView);
}

export async function submitClaimAction(raw: unknown, itemIds: unknown): Promise<ClaimView | { error: string }> {
  const t = token.safeParse(raw);
  const ids = z.array(z.uuid()).max(80).safeParse(itemIds);
  if (!t.success || !ids.success) return { error: "That link doesn't look right." };
  if (!(await checkRateLimit("claim-submit", "", 30))) return { error: "Too many changes at once. Give it a moment." };
  if (isDemo) return demoStore.claimSubmit(t.data, ids.data);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("bill_claim_submit", { p_token: t.data, p_item_ids: ids.data });
  if (error) return { error: error.code === "23514" ? "This bill has been closed." : "This link has expired." };
  return data as unknown as ClaimView;
}
