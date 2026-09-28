"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { activePass, canGift, createGiftSchema, extendSchema, giftCandidates, purchaseSchema, type PurchaseReceipt } from "@voya/core";
import { billing } from "@/lib/billing";
import { getEntitlements, getTripBundle, getTrips, now } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo, publicEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export type PurchaseState = { error?: string } | null;
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/**
 * A paid receipt becomes an entitlement only in demo mode, where the mock is the billing
 * provider. In real mode the vendor's webhook grants it with the service role; the app
 * never writes entitlements itself.
 */
async function settle(receipt: PurchaseReceipt, tripId: string | null, tz: string): Promise<string | null> {
  if (!isDemo) return null;
  const trip = (await getTrips()).find((t) => t.id === tripId) ?? null;
  const e = await demoStore.grant(receipt, trip, tz);
  revalidatePath("/", "layout");
  return e.id;
}

export async function purchaseAction(_prev: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const user = await requireUser();
  const parsed = purchaseSchema.safeParse({ plan: str(formData.get("plan")), tripId: str(formData.get("tripId")) || null, method: str(formData.get("method")) || "card" });
  if (!parsed.success) return { error: "Choose a plan and a way to pay." };
  if (!(await checkRateLimit("purchase", user.id, 30))) return { error: "Too many attempts. Try again in a minute." };
  const { plan, tripId, method } = parsed.data;
  if (plan === "trip" && !tripId) return { error: "A single-trip pass needs a trip." };
  if (tripId && !(await getTrips()).some((t) => t.id === tripId)) return { error: "Trip not found." };
  if (activePass(await getEntitlements(), tripId, now())) return { error: "You already have Atlas Premium Pass." };
  const r = await billing.purchase({ plan, userId: user.id, tripId: plan === "trip" ? tripId : null, method });
  if (r.status === "unavailable") return { error: r.message };
  if (r.status === "redirect") redirect(r.url as Route);
  const id = await settle(r.receipt, tripId, user.profile.home_tz);
  if (!id) return { error: "Payment received. Your pass appears once the billing webhook confirms it." };
  redirect(`/pass/done?e=${id}` as Route);
}

/** $0.99 extension of a gifted pass, 1–7 days. */
export async function extendAction(_prev: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const user = await requireUser();
  const parsed = extendSchema.safeParse({ tripId: str(formData.get("tripId")), days: Number(str(formData.get("days"))), method: str(formData.get("method")) || "card" });
  if (!parsed.success) return { error: "Pick 1 to 7 days." };
  if (!(await checkRateLimit("purchase", user.id, 30))) return { error: "Too many attempts. Try again in a minute." };
  const { tripId, days, method } = parsed.data;
  const gifted = (await getEntitlements()).some((e) => e.trip_id === tripId && (e.kind === "gift" || e.kind === "extension"));
  if (!gifted) return { error: "Extensions are for gifted passes. Get a single-trip pass instead." };
  const r = await billing.purchase({ plan: "extension", userId: user.id, tripId, days, method });
  if (r.status === "unavailable") return { error: r.message };
  if (r.status === "redirect") redirect(r.url as Route);
  const id = await settle(r.receipt, tripId, user.profile.home_tz);
  if (!id) return { error: "Payment received. Your extension appears once the billing webhook confirms it." };
  redirect(`/pass/done?e=${id}` as Route);
}

/** Restore: re-grant every receipt the provider holds for this user (idempotent on the receipt id). */
export async function restoreAction(): Promise<{ restored: number } | { error: string }> {
  const user = await requireUser();
  if (!(await checkRateLimit("purchase", user.id, 10))) return { error: "Too many attempts. Try again in a minute." };
  const receipts = await billing.restore(user.id);
  let restored = 0;
  for (const r of receipts) if (await settle(r, r.tripId, user.profile.home_tz)) restored++;
  return { restored };
}

/** A Monthly/Yearly member gifts one traveler on the trip 3 days; the link carries the code. */
export async function createGiftAction(tripId: unknown, travelerId: unknown): Promise<{ url: string; code: string } | { error: string }> {
  const user = await requireUser();
  const p = createGiftSchema.safeParse({ tripId, travelerId });
  if (!p.success) return { error: "Pick a traveler." };
  if (!(await checkRateLimit("gift", user.id, 30))) return { error: "Too many gifts at once." };
  const bundle = await getTripBundle(p.data.tripId);
  if (!bundle) return { error: "Trip not found." };
  const allowed = canGift(await getEntitlements(), bundle.trip.id, bundle.passGifts, user.id, now());
  if (!allowed.ok) return { error: allowed.reason };
  const candidate = giftCandidates(bundle.travelers, bundle.passMarks, user.id).find((c) => c.traveler.id === p.data.travelerId);
  if (!candidate) return { error: "That traveler isn't on this trip." };
  if (!candidate.eligible) return { error: `${candidate.traveler.name} already has a pass.` };
  let code: string | null;
  if (isDemo) code = (await demoStore.createGift(bundle.trip.id, user.id, candidate.traveler.id))?.code ?? null;
  else {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc("create_pass_gift", { p_trip_id: bundle.trip.id, p_traveler_id: candidate.traveler.id });
    code = error ? null : ((data as { code?: string } | null)?.code ?? null);
  }
  if (!code) return { error: "Couldn't create the gift." };
  revalidatePath(`/trips/${bundle.trip.id}/people`);
  revalidatePath("/pass");
  return { url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/gift/${code}`, code };
}

/** Redeem by typing a code: sends the person to the gift page, which does the accepting. */
export async function redeemCodeAction(formData: FormData) {
  const code = z.string().trim().toLowerCase().regex(/^[a-f0-9]{24}$/).safeParse(str(formData.get("code")));
  if (!code.success) redirect("/pass?redeem=1&error=code" as Route);
  redirect(`/gift/${code.data}` as Route);
}
