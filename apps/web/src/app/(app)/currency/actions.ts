"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tripCurrencySchema, type CachedRate, type TripCurrencyRow } from "@voya/core";
import { getTripBundle } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { fx } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

type Result<T> = T | { error: string };
const iso3 = z.string().regex(/^[A-Z]{3}$/);

/** Mid-market rate for a pair, from the server-side cache (stale when offline). */
export async function rateAction(base: unknown, quote: unknown): Promise<Result<CachedRate>> {
  const user = await requireUser();
  const p = z.object({ base: iso3, quote: iso3 }).safeParse({ base, quote });
  if (!p.success) return { error: "Use 3-letter currency codes." };
  if (!(await checkRateLimit("fx", user.id, 60))) return { error: "Too many rate lookups at once." };
  try {
    return await fx.rate(p.data.base, p.data.quote);
  } catch {
    return { error: `No rate for ${p.data.base} → ${p.data.quote} right now, and nothing cached yet.` };
  }
}

export async function addTripCurrencyAction(input: unknown): Promise<Result<TripCurrencyRow>> {
  await requireUser();
  const parsed = tripCurrencySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the currency." };
  const bundle = await getTripBundle(parsed.data.tripId);
  if (!bundle) return { error: "Trip not found." };
  if (bundle.tripCurrencies.length >= 12) return { error: "Up to 12 currencies per trip." };
  // The label is shown as "KRW · Seoul layover"; store just the note.
  const label = parsed.data.label ? `${parsed.data.code} · ${parsed.data.label}` : null;
  let row: TripCurrencyRow | null;
  if (isDemo) row = await demoStore.addCurrency({ ...parsed.data, label });
  else {
    const db = await createServerSupabase();
    const values = { trip_id: parsed.data.tripId, code: parsed.data.code, label, sort_order: bundle.tripCurrencies.length };
    const { error } = await db.from("trip_currencies").upsert(values, { onConflict: "trip_id,code" });
    row = error ? null : { ...values, created_at: new Date().toISOString() };
  }
  if (!row) return { error: "Couldn't add the currency." };
  revalidatePath("/currency");
  return row;
}

export async function removeTripCurrencyAction(tripId: unknown, code: unknown): Promise<Result<{ ok: true }>> {
  await requireUser();
  const p = z.object({ tripId: z.uuid(), code: iso3 }).safeParse({ tripId, code });
  if (!p.success) return { error: "Currency not found." };
  let ok: boolean;
  if (isDemo) ok = await demoStore.removeCurrency(p.data.tripId, p.data.code);
  else {
    const db = await createServerSupabase();
    const { error, count } = await db.from("trip_currencies").delete({ count: "exact" }).eq("trip_id", p.data.tripId).eq("code", p.data.code);
    ok = !error && (count ?? 0) > 0;
  }
  if (!ok) return { error: "Couldn't remove the currency." };
  revalidatePath("/currency");
  return { ok: true };
}
