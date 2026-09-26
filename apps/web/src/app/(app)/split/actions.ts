"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { activePass, billSchema, languageByCode, parseReceipt, type BillInput, type ParsedItem, type ParsedReceipt } from "@voya/core";
import { getActiveTrip, getEntitlements, getTripBundle, now } from "@/lib/data";
import { demoStore } from "@/lib/demo-store";
import { isDemo, publicEnv } from "@/lib/env";
import { ocr, translation } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

type Result<T> = T | { error: string };
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Split is part of Atlas Premium Pass: every action checks the pass for the trip. */
async function requirePass(tripId: string) {
  const user = await requireUser();
  if (!activePass(await getEntitlements(), tripId, now())) throw new Error("Atlas Premium Pass required");
  return user;
}

export interface ScannedReceipt extends ParsedReceipt { items: (ParsedItem & { name: string })[]; pages: number }

/**
 * Read a receipt photo: OCR, then each item name translated into the traveler's language.
 * The photo is read into memory, handed to the provider and dropped; nothing is stored.
 */
export async function scanReceiptAction(formData: FormData): Promise<Result<ScannedReceipt>> {
  const user = await requireUser();
  const tripId = z.uuid().safeParse(formData.get("tripId"));
  if (!tripId.success) return { error: "Trip not found." };
  await requirePass(tripId.data);
  const bundle = await getTripBundle(tripId.data);
  if (!bundle) return { error: "Trip not found." };
  const files = formData.getAll("image").filter((f): f is File => f instanceof File && f.size > 0);
  const sample = formData.get("sample") === "1";
  if (!sample) {
    if (!files.length) return { error: "Choose a photo first." };
    if (files.length > 10) return { error: "Up to 10 pages per receipt." };
    for (const f of files) {
      if (!IMAGE_TYPES.has(f.type)) return { error: "That file isn't a photo we can read (JPEG, PNG, WebP or HEIC)." };
      if (f.size > MAX_IMAGE_BYTES) return { error: "Photos up to 8 MB, please." };
    }
  }
  if (!(await checkRateLimit("ocr", user.id, 20))) return { error: "Too many photos at once. Give it a moment." };
  const from = languageByCode(bundle.trip.local_language)?.code ?? "en", to = languageByCode(user.profile.locale)?.code ?? "en";
  try {
    const lines = [];
    for (const f of sample ? [null] : files) lines.push(...(await ocr.recognize(f ? await f.arrayBuffer() : new ArrayBuffer(0), { languageHints: [from], document: "receipt" })));
    const parsed = parseReceipt(lines);
    const items = await Promise.all(parsed.items.map(async (i) => {
      const t = from === to ? { text: i.localName, approximate: false } : await translation.translate(i.localName, from, to);
      return { ...i, name: t.approximate ? i.localName : t.text };
    }));
    return { ...parsed, items, pages: sample ? 2 : files.length };
  } catch {
    return { error: "Couldn't read that receipt. Try a sharper photo with more light." };
  }
}

/** Create or replace a bill. Every item/participant must be on the caller's trip; new ids are minted here. */
export async function saveBillAction(input: unknown): Promise<Result<{ billId: string }>> {
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the bill." };
  const user = await requirePass(parsed.data.tripId);
  const bundle = await getTripBundle(parsed.data.tripId);
  if (!bundle) return { error: "Trip not found." };
  if (parsed.data.billId && !bundle.bills.some((b) => b.id === parsed.data.billId)) return { error: "Bill not found." };
  if (parsed.data.placeId && !bundle.places.some((p) => p.id === parsed.data.placeId)) return { error: "That place isn't on this trip." };
  if (!parsed.data.participants.every((p) => !p.travelerId || bundle.travelers.some((t) => t.id === p.travelerId))) return { error: "One of the people isn't on this trip." };
  const existingItems = new Set(bundle.billItems.filter((i) => i.bill_id === parsed.data.billId).map((i) => i.id));
  const existingPeople = new Set(bundle.billParticipants.filter((p) => p.bill_id === parsed.data.billId).map((p) => p.id));
  // Keep ids of rows that already exist on this bill (their claim tokens survive); mint the rest.
  const itemIds = new Map(parsed.data.items.map((i) => [i.id, existingItems.has(i.id) ? i.id : crypto.randomUUID()]));
  const peopleIds = new Map(parsed.data.participants.map((p) => [p.id, existingPeople.has(p.id) ? p.id : crypto.randomUUID()]));
  const bill: BillInput = {
    ...parsed.data,
    items: parsed.data.items.map((i) => ({ ...i, id: itemIds.get(i.id)! })),
    participants: parsed.data.participants.map((p) => ({ ...p, id: peopleIds.get(p.id)! })),
    shares: parsed.data.shares.map((s) => ({ itemId: itemIds.get(s.itemId)!, participantId: peopleIds.get(s.participantId)! })),
    paidBy: parsed.data.paidBy ? peopleIds.get(parsed.data.paidBy)! : null,
  };
  let billId: string | null;
  if (isDemo) billId = await demoStore.saveBill(bill, user.id);
  else {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc("save_bill", {
      p_bill_id: bill.billId, p_trip_id: bill.tripId,
      p_bill: { place_id: bill.placeId, merchant: bill.merchant, currency: bill.currency, status: bill.status, bill_date: bill.billDate, tax_amount: bill.taxAmount, tax_label: bill.taxLabel, service_amount: bill.serviceAmount, discount_amount: bill.discountAmount, rounding_unit: bill.roundingUnit, tax_mode: bill.taxMode, paid_by: bill.paidBy },
      p_items: bill.items.map((i, n) => ({ id: i.id, name: i.name, local_name: i.localName, qty: i.qty, unit_price: i.unitPrice, confidence: i.confidence, sort_order: n })),
      p_participants: bill.participants.map((p) => ({ id: p.id, traveler_id: p.travelerId, name: p.name, color: p.color, home_currency: p.homeCurrency })),
      p_shares: bill.shares.map((s) => ({ item_id: s.itemId, participant_id: s.participantId })),
    });
    billId = error ? null : data;
  }
  if (!billId) return { error: "Couldn't save the bill." };
  revalidatePath("/split"); revalidatePath(`/split/${billId}`);
  return { billId };
}

export async function deleteBillAction(tripId: unknown, billId: unknown): Promise<Result<{ ok: true }>> {
  const p = z.object({ tripId: z.uuid(), billId: z.uuid() }).safeParse({ tripId, billId });
  if (!p.success) return { error: "Bill not found." };
  await requirePass(p.data.tripId);
  let ok: boolean;
  if (isDemo) ok = await demoStore.deleteBill(p.data.tripId, p.data.billId);
  else {
    const db = await createServerSupabase();
    const { error, count } = await db.from("bills").delete({ count: "exact" }).eq("id", p.data.billId).eq("trip_id", p.data.tripId);
    ok = !error && (count ?? 0) > 0;
  }
  if (!ok) return { error: "Couldn't delete the bill." };
  revalidatePath("/split");
  return { ok: true };
}

/** Turn on a person's claim link (marks it sent) and return the URL to share. */
export async function claimLinkAction(tripId: unknown, billId: unknown, participantId: unknown): Promise<Result<{ url: string }>> {
  const p = z.object({ tripId: z.uuid(), billId: z.uuid(), participantId: z.uuid() }).safeParse({ tripId, billId, participantId });
  if (!p.success) return { error: "Person not found." };
  await requirePass(p.data.tripId);
  let token: string | null;
  if (isDemo) token = await demoStore.markClaimSent(p.data.tripId, p.data.billId, p.data.participantId);
  else {
    const db = await createServerSupabase();
    const { data, error } = await db.from("bill_participants").select("claim_token, claim_status").eq("id", p.data.participantId).eq("bill_id", p.data.billId).eq("trip_id", p.data.tripId).maybeSingle();
    token = error || !data ? null : data.claim_token;
    if (token && data?.claim_status === "none") await db.from("bill_participants").update({ claim_status: "sent" }).eq("id", p.data.participantId).eq("trip_id", p.data.tripId);
  }
  if (!token) return { error: "Couldn't create the link." };
  revalidatePath(`/split/${p.data.billId}`);
  return { url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/s/${token}` };
}

const linesSchema = z.array(z.object({ name: z.string().max(120), localName: z.string().max(120).nullable(), price: z.number().min(0).max(1e9) })).min(1).max(80);

/** Camera → "Send to Split": start a draft bill from translated lines and open it. */
export async function startBillFromLinesAction(lines: unknown, placeId: unknown) {
  const user = await requireUser();
  const active = await getActiveTrip(user.profile.home_tz);
  if (!active) return { error: "No active trip." };
  await requirePass(active.id);
  const parsed = linesSchema.safeParse(lines);
  if (!parsed.success) return { error: "Nothing to split." };
  const bundle = await getTripBundle(active.id);
  const place = bundle?.places.find((p) => p.id === placeId);
  const r = await saveBillAction({
    tripId: active.id, placeId: place?.id ?? null, merchant: place?.name ?? "Receipt", currency: active.local_currency ?? user.profile.home_currency, status: "draft",
    items: parsed.data.map((l, i) => ({ id: `i${i}`, name: l.name || l.localName || "Item", localName: l.localName, qty: 1, unitPrice: l.price, confidence: null })),
    participants: (bundle?.travelers ?? []).map((t) => ({ id: t.id, travelerId: t.id, name: t.name.split(" ")[0]!, color: t.color, homeCurrency: t.home_currency ?? (t.user_id === user.id ? user.profile.home_currency : null) })),
    shares: [],
  });
  if ("error" in r) return r;
  redirect(`/split/${r.billId}` as "/split");
}
