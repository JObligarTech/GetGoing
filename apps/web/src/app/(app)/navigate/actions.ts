"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { routeSchema } from "@voya/core";
import { getTripBundle } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/app/auth/actions";

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "form"); if (!out[k]) out[k] = i.message; }
  return out;
}

/** Save the current multi-stop route under a name. Stops arrive as "placeId@HH:MM,…". */
export async function saveRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = String(formData.get("stops") ?? "");
  const stops = raw.split(",").filter(Boolean).map((s) => { const [placeId, t] = s.split("@"); return { placeId, plannedTime: t && /^\d{2}:\d{2}$/.test(t) ? t : null }; });
  const parsed = routeSchema.safeParse({ tripId: formData.get("tripId"), name: formData.get("name"), day: formData.get("day") || null, mode: formData.get("mode"), stops });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { name: String(formData.get("name") ?? "") } };
  const { tripId, name, day, mode } = parsed.data;

  // Every stop must be a place on this trip (RLS would also reject, but fail early with a clean message).
  const bundle = await getTripBundle(tripId);
  if (!bundle) return { error: "Trip not found." };
  if (!parsed.data.stops.every((s) => bundle.places.some((p) => p.id === s.placeId))) return { error: "One of the stops isn't on this trip." };

  if (isDemo) {
    await demoStore.saveRoute(tripId, { name, day, mode, stops: parsed.data.stops }, user.id);
  } else {
    const db = await createServerSupabase();
    const { data: route, error } = await db.from("routes").insert({ trip_id: tripId, name, day, mode, created_by: user.id }).select("id").single();
    if (error || !route) return { error: "Couldn't save the route." };
    const { error: e2 } = await db.from("route_stops").insert(parsed.data.stops.map((s, i) => ({ route_id: route.id, trip_id: tripId, place_id: s.placeId, sort_order: i, planned_time: s.plannedTime })));
    if (e2) return { error: "Couldn't save the stops." };
  }
  revalidatePath("/navigate");
  return { ok: true, message: `Saved "${name}" to your routes.` };
}
