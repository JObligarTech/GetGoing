import { demoBundle, demoProfile, demoTrips } from "@voya/core";
import { isDemo } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GDPR/CCPA data export — the signed-in user's data only (RLS-scoped RPC). */
export async function GET(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  if (isDemo) {
    payload = { profile: demoProfile, trips: demoTrips, places: demoBundle.places, stays: demoBundle.stays, itinerary: demoBundle.itinerary, exported_at: new Date().toISOString() };
  } else {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("export_my_data");
    if (error) return new Response("Export failed", { status: 500 });
    payload = data;
  }
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="voya-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
