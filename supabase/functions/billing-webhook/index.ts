// Supabase Edge Function: the only writer of Atlas Premium Pass entitlements.
//
// A billing vendor (Stripe, RevenueCat, App Store Server Notifications, Play RTDN)
// POSTs purchase events here. The function verifies the vendor's signature, maps the
// event to grant_pass / grant_extension and calls it with the service role. Clients
// never hold that key and never write entitlements.
//
// Deploy: supabase functions deploy billing-webhook --no-verify-jwt
// Secrets: BILLING_WEBHOOK_SECRET (shared with the vendor), SUPABASE_SERVICE_ROLE_KEY (set by Supabase).
//
// This is a stub: the HMAC scheme below matches the mock provider's shape. Replace
// `verify` and `parse` with the vendor SDK once a provider is chosen; the database side
// (idempotent on plan_ref) stays the same.
import { createClient } from "npm:@supabase/supabase-js@2";

interface PurchaseEvent {
  type: "purchase" | "extension";
  receiptId: string;
  userId: string;
  plan: "trip" | "monthly" | "yearly" | "extension";
  tripId: string | null;
  days?: number;
  paidWith?: string;
  amount?: number;
  currency?: string;
}

const encoder = new TextEncoder();
async function verify(raw: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(raw)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parse(raw: string): PurchaseEvent | null {
  let e: Partial<PurchaseEvent>;
  try { e = JSON.parse(raw); } catch { return null; }
  if (!e || typeof e !== "object") return null;
  if (typeof e.receiptId !== "string" || e.receiptId.length > 120 || typeof e.userId !== "string" || !UUID.test(e.userId)) return null;
  if (!["trip", "monthly", "yearly", "extension"].includes(e.plan as string)) return null;
  if (e.tripId != null && (typeof e.tripId !== "string" || !UUID.test(e.tripId))) return null;
  return e as PurchaseEvent;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const secret = Deno.env.get("BILLING_WEBHOOK_SECRET");
  if (!secret) return new Response("webhook not configured", { status: 503 });
  const raw = await req.text();
  if (raw.length > 16_384 || !(await verify(raw, req.headers.get("x-voya-signature"), secret))) return new Response("bad signature", { status: 401 });
  const event = parse(raw);
  if (!event) return new Response("bad event", { status: 400 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const source = req.headers.get("x-voya-provider") ?? "webhook";
  const { data, error } = event.plan === "extension"
    ? await db.rpc("grant_extension", { p_user_id: event.userId, p_trip_id: event.tripId!, p_days: event.days ?? 0, p_plan_ref: event.receiptId, p_paid_with: event.paidWith ?? null, p_source: source })
    : await db.rpc("grant_pass", { p_user_id: event.userId, p_kind: event.plan, p_trip_id: event.tripId, p_plan_ref: event.receiptId, p_paid_with: event.paidWith ?? null, p_amount: event.amount ?? null, p_currency: event.currency ?? null, p_source: source });
  if (error) return Response.json({ error: error.message }, { status: error.code === "P0002" ? 404 : 422 });
  return Response.json({ entitlement_id: data });
});
