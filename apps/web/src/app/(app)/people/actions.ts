"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nextTravelerColor, travelerSchema, type TravelerRow } from "@voya/core";
import { getTripBundle } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo, publicEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

type Result<T> = T | { error: string };
const revalidate = (tripId: string) => { revalidatePath(`/trips/${tripId}/people`); revalidatePath(`/trips/${tripId}`); revalidatePath("/split"); };

/** Add a guest traveler (no account needed). */
export async function addTravelerAction(input: unknown): Promise<Result<TravelerRow>> {
  await requireUser();
  const parsed = travelerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const bundle = await getTripBundle(parsed.data.tripId);
  if (!bundle) return { error: "Trip not found." };
  if (bundle.travelers.length >= 50) return { error: "Up to 50 travelers per trip." };
  let row: TravelerRow | null;
  if (isDemo) row = await demoStore.addTraveler(parsed.data);
  else {
    const db = await createServerSupabase();
    const values = { id: crypto.randomUUID(), trip_id: parsed.data.tripId, name: parsed.data.name, color: parsed.data.color ?? nextTravelerColor(bundle.travelers), email: parsed.data.email, phone: parsed.data.phone, home_currency: parsed.data.homeCurrency, joining_start: parsed.data.joiningStart, joining_end: parsed.data.joiningEnd, joining_note: parsed.data.joiningNote };
    const { error } = await db.from("travelers").insert(values);
    const ts = new Date().toISOString();
    row = error ? null : { ...values, user_id: null, created_at: ts, updated_at: ts };
  }
  if (!row) return { error: "Couldn't add the traveler." };
  revalidate(parsed.data.tripId);
  return row;
}

export async function updateTravelerAction(id: unknown, input: unknown): Promise<Result<TravelerRow>> {
  await requireUser();
  const tid = z.uuid().safeParse(id);
  const parsed = travelerSchema.safeParse(input);
  if (!tid.success || !parsed.success) return { error: parsed.success ? "Traveler not found." : parsed.error.issues[0]?.message ?? "Check the details." };
  const bundle = await getTripBundle(parsed.data.tripId);
  const current = bundle?.travelers.find((t) => t.id === tid.data);
  if (!bundle || !current) return { error: "Traveler not found." };
  let row: TravelerRow | null;
  if (isDemo) row = await demoStore.updateTraveler(tid.data, parsed.data);
  else {
    const db = await createServerSupabase();
    const values = { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone, home_currency: parsed.data.homeCurrency, joining_start: parsed.data.joiningStart, joining_end: parsed.data.joiningEnd, joining_note: parsed.data.joiningNote, color: parsed.data.color ?? current.color };
    const { error } = await db.from("travelers").update(values).eq("id", tid.data).eq("trip_id", parsed.data.tripId);
    row = error ? null : { ...current, ...values };
  }
  if (!row) return { error: "Couldn't save the traveler." };
  revalidate(parsed.data.tripId);
  return row;
}

/** Guests can be removed; account holders leave through trip membership. */
export async function removeTravelerAction(tripId: unknown, id: unknown): Promise<Result<{ ok: true }>> {
  await requireUser();
  const p = z.object({ tripId: z.uuid(), id: z.uuid() }).safeParse({ tripId, id });
  if (!p.success) return { error: "Traveler not found." };
  const bundle = await getTripBundle(p.data.tripId);
  const t = bundle?.travelers.find((x) => x.id === p.data.id);
  if (!bundle || !t) return { error: "Traveler not found." };
  if (t.user_id) return { error: "Travelers with an account leave from their own profile." };
  let ok: boolean;
  if (isDemo) ok = await demoStore.removeTraveler(p.data.tripId, p.data.id);
  else {
    const db = await createServerSupabase();
    const { error, count } = await db.from("travelers").delete({ count: "exact" }).eq("id", p.data.id).eq("trip_id", p.data.tripId).is("user_id", null);
    ok = !error && (count ?? 0) > 0;
  }
  if (!ok) return { error: "Couldn't remove the traveler." };
  revalidate(p.data.tripId);
  return { ok: true };
}

/** An invite link for a guest: the only way a guest becomes a member. Reuses an unexpired one. */
export async function createInviteAction(tripId: unknown, travelerId: unknown): Promise<Result<{ url: string; expiresAt: string }>> {
  const user = await requireUser();
  const p = z.object({ tripId: z.uuid(), travelerId: z.uuid().nullable() }).safeParse({ tripId, travelerId: travelerId ?? null });
  if (!p.success) return { error: "Traveler not found." };
  if (!(await checkRateLimit("invite", user.id, 30))) return { error: "Too many invites at once." };
  const bundle = await getTripBundle(p.data.tripId);
  if (!bundle) return { error: "Trip not found." };
  if (p.data.travelerId && !bundle.travelers.some((t) => t.id === p.data.travelerId && !t.user_id)) return { error: "Only guests can be invited." };
  let token: string | null = null, expiresAt: string;
  if (isDemo) {
    const inv = await demoStore.createInvite(p.data.tripId, p.data.travelerId, user.id);
    token = inv?.token ?? null; expiresAt = inv?.expires_at ?? "";
  } else {
    const db = await createServerSupabase();
    const existing = bundle.tripInvites.find((i) => i.traveler_id === p.data.travelerId && new Date(i.expires_at) > new Date());
    if (existing) { token = existing.token; expiresAt = existing.expires_at; }
    else {
      // The token is issued by the database default; read it back (members can select their trip's invites).
      const { data, error } = await db.from("trip_invites").insert({ trip_id: p.data.tripId, traveler_id: p.data.travelerId, created_by: user.id }).select("token, expires_at").single();
      token = error ? null : data.token; expiresAt = data?.expires_at ?? "";
    }
  }
  if (!token) return { error: "Couldn't create the invite." };
  revalidate(p.data.tripId);
  return { url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/join/${token}`, expiresAt };
}
