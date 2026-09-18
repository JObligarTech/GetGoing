"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { tripSchema } from "@voya/core";
import { ACTIVE_TRIP_COOKIE, getTripBundle, getTrips } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/app/auth/actions";

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

/** Trip switcher: only trips the user can actually see (RLS/demo list) are accepted. */
export async function setActiveTrip(formData: FormData) {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("tripId"));
  if (!id.success) return;
  const trips = await getTrips();
  if (!trips.some((t) => t.id === id.data)) return;
  (await cookies()).set(ACTIVE_TRIP_COOKIE, id.data, cookieOpts);
  const back = formData.get("back");
  redirect(typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? (back as "/home") : "/home");
}

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "form"); if (!out[k]) out[k] = i.message; }
  return out;
}

const list = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const opt = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function createTrip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = tripSchema.safeParse({
    name: formData.get("name"),
    countries: list(formData.get("countries")).map((c) => c.toUpperCase()),
    cities: list(formData.get("cities")),
    startDate: opt(formData.get("startDate")),
    endDate: opt(formData.get("endDate")),
    localCurrency: opt(formData.get("localCurrency"))?.toUpperCase() ?? null,
    localTz: opt(formData.get("localTz")),
    localLanguage: opt(formData.get("localLanguage")),
    notes: opt(formData.get("notes")),
  });
  if (!parsed.success) {
    const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")) as [string, string][]);
    return { fieldErrors: fieldErrors(parsed.error), values };
  }

  let id: string;
  if (isDemo) {
    id = (await demoStore.createTrip(parsed.data, user.id)).id;
  } else {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trips")
      .insert({
        owner_id: user.id, name: parsed.data.name, countries: parsed.data.countries, cities: parsed.data.cities,
        start_date: parsed.data.startDate, end_date: parsed.data.endDate, status: parsed.data.startDate ? "upcoming" : "draft",
        local_currency: parsed.data.localCurrency, local_tz: parsed.data.localTz, local_language: parsed.data.localLanguage, notes: parsed.data.notes,
      })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't create the trip. Try again." };
    id = data.id;
  }
  (await cookies()).set(ACTIVE_TRIP_COOKIE, id, cookieOpts);
  revalidatePath("/trips");
  redirect(`/trips/${id}` as "/trips");
}

/** Fill an open itinerary slot with a saved place (Plan → open slot → suggestion). */
export async function assignPlaceToSlot(formData: FormData) {
  await requireUser();
  const p = z.object({ tripId: z.uuid(), itemId: z.uuid().or(z.string().regex(/^i\d+$/)), placeId: z.uuid(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse({ tripId: formData.get("tripId"), itemId: formData.get("itemId"), placeId: formData.get("placeId"), day: formData.get("day") });
  if (!p.success) return;
  const bundle = await getTripBundle(p.data.tripId);
  if (!bundle) return;
  if (isDemo) {
    await demoStore.assignPlaceToSlot(p.data.tripId, p.data.itemId, p.data.placeId);
  } else {
    const db = await createServerSupabase();
    // RLS: editors only; the trip_id filter prevents cross-trip writes even with a guessed item id.
    await db.from("itinerary_items").update({ place_id: p.data.placeId, note: null }).eq("id", p.data.itemId).eq("trip_id", p.data.tripId);
  }
  revalidatePath("/plan");
  redirect(`/plan?day=${p.data.day}` as "/plan");
}
