/**
 * zod schemas — every server action / form / API boundary validates with these.
 * Keep them the single place that knows field limits (they mirror the SQL checks).
 */
import { z } from "zod";

const iso3 = z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a #RRGGBB colour");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

/** Trim + strip control chars; we never render HTML from user text, but keep it tidy. */
const text = (max: number, min = 1) =>
  z.string().transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim()).pipe(z.string().min(min).max(max));

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
/** ≥10 chars, upper + lower + digit — matches supabase/config.toml password policy. */
export const passwordSchema = z
  .string()
  .min(10, "At least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number");

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

export const MIN_AGE = 16;
export const signUpSchema = z
  .object({
    displayName: text(80),
    email: emailSchema,
    password: passwordSchema,
    // Field-level so the message shows even when sibling fields are also invalid.
    dateOfBirth: dateStr.refine((d) => ageOn(d, new Date()) >= MIN_AGE, `You must be ${MIN_AGE} or older`),
    acceptTerms: z.literal(true, { error: "You need to accept the Terms and Privacy Policy" }),
    marketingOptIn: z.boolean().default(false),
  });

export function ageOn(dob: string, at: Date): number {
  const [y, m, d] = dob.split("-").map(Number) as [number, number, number];
  let age = at.getUTCFullYear() - y;
  const before = at.getUTCMonth() + 1 < m || (at.getUTCMonth() + 1 === m && at.getUTCDate() < d);
  if (before) age -= 1;
  return age;
}

export const resetRequestSchema = z.object({ email: emailSchema });

export const tripSchema = z
  .object({
    name: text(120),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(20).default([]),
    cities: z.array(text(80)).max(30).default([]),
    startDate: dateStr.nullable().default(null),
    endDate: dateStr.nullable().default(null),
    localCurrency: iso3.nullable().default(null),
    localTz: z.string().max(64).nullable().default(null),
    localLanguage: z.string().max(16).nullable().default(null),
    notes: text(4000, 0).nullable().default(null),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, { path: ["endDate"], message: "End date must be after start" });
export type TripInput = z.infer<typeof tripSchema>;

export const placeSchema = z.object({
  tripId: z.uuid(),
  name: text(160),
  address: text(400, 0).nullable().default(null),
  localName: text(160, 0).nullable().default(null),
  localAddress: text(400, 0).nullable().default(null),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  provider: z.enum(["osm", "google", "manual"]).default("manual"),
  providerRef: z.string().max(200).nullable().default(null),
  phone: text(40, 0).nullable().default(null),
  // http(s) only — blocks javascript:/data: URLs from ever being rendered as links.
  website: z.url({ protocol: /^https?$/, hostname: z.regexes.domain }).max(400).nullable().default(null),
  notes: text(4000, 0).nullable().default(null),
  priority: z.enum(["must", "maybe", "skip"]).default("maybe"),
  categoryIds: z.array(z.uuid()).max(20).default([]),
});
export type PlaceInput = z.infer<typeof placeSchema>;

export const categorySchema = z.object({
  tripId: z.uuid(),
  name: text(40),
  icon: z.string().max(32).default("pin"),
  color: hex.default("#2F5D3A"),
});

export const staySchema = z
  .object({
    tripId: z.uuid(),
    placeId: z.uuid(),
    kind: z.enum(["hotel", "airbnb", "hostel", "friend", "rental", "other"]).default("hotel"),
    checkIn: z.iso.datetime({ offset: true }).nullable().default(null),
    checkOut: z.iso.datetime({ offset: true }).nullable().default(null),
    confirmation: text(80, 0).nullable().default(null),
    notes: text(4000, 0).nullable().default(null),
  })
  .refine((v) => !v.checkIn || !v.checkOut || v.checkIn < v.checkOut, { path: ["checkOut"], message: "Check-out must be after check-in" });

export const itineraryItemSchema = z
  .object({
    tripId: z.uuid(),
    placeId: z.uuid().nullable().default(null),
    day: dateStr,
    startTime: timeStr.nullable().default(null),
    title: text(160, 0).nullable().default(null),
    note: text(1000, 0).nullable().default(null),
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine((v) => v.placeId || v.title, { message: "Pick a place or give the slot a title" });

export const routeSchema = z.object({
  tripId: z.uuid(),
  name: text(120),
  day: dateStr.nullable().default(null),
  mode: z.enum(["walk", "transit", "drive", "cycle"]).default("transit"),
  stops: z.array(z.object({ placeId: z.uuid(), plannedTime: timeStr.nullable().default(null) })).min(2).max(30),
});
export type RouteInput = z.infer<typeof routeSchema>;

const shortId = z.string().min(1).max(64);
const mode = z.enum(["walk", "transit", "drive", "cycle"]);
/** A whole navigation tree, as sent by the editor. Ids are re-minted server-side before storage. */
export const treeSchema = z.object({
  routeId: z.uuid().nullable().default(null),
  tripId: z.uuid(),
  name: text(120),
  day: dateStr.nullable().default(null),
  mode: mode.default("transit"),
  stops: z.array(z.object({
    id: shortId, placeId: z.uuid(), branchId: shortId.nullable().default(null), sortOrder: z.number().int().min(0).max(1000),
    plannedTime: timeStr.nullable().default(null), dwellMin: z.number().int().min(0).max(1440).nullable().default(null), mode: mode.nullable().default(null),
  })).min(2).max(60),
  branches: z.array(z.object({
    id: shortId, name: text(40), color: hex, sortOrder: z.number().int().min(0).max(100), splitAfterStopId: shortId,
    mergeMode: mode.nullable().default(null), travelerIds: z.array(shortId).max(50),
  })).max(12),
}).superRefine((t, ctx) => {
  const stopIds = new Set(t.stops.map((s) => s.id)), branchIds = new Set(t.branches.map((b) => b.id));
  if (stopIds.size !== t.stops.length || branchIds.size !== t.branches.length) ctx.addIssue({ code: "custom", message: "Duplicate ids", path: ["stops"] });
  for (const s of t.stops) if (s.branchId && !branchIds.has(s.branchId)) ctx.addIssue({ code: "custom", message: "Stop refers to a missing branch", path: ["stops"] });
  for (const b of t.branches) {
    const split = t.stops.find((s) => s.id === b.splitAfterStopId);
    if (!split || split.branchId !== null) ctx.addIssue({ code: "custom", message: "Branches must split from a trunk stop", path: ["branches"] });
  }
  if (!t.stops.some((s) => s.branchId === null)) ctx.addIssue({ code: "custom", message: "A route needs at least one shared stop", path: ["stops"] });
});
export type TreeInput = z.infer<typeof treeSchema>;

const langCode = z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, "Use a language code");
/** One translation request; the text limit matches the textarea counter. */
export const translateSchema = z.object({ text: text(500), from: langCode, to: langCode });
export type TranslateInput = z.infer<typeof translateSchema>;
/** A saved phrase on a trip. */
export const phraseSchema = z.object({
  tripId: z.uuid(),
  sourceText: text(500),
  sourceLang: langCode,
  targetText: text(1000),
  targetLang: langCode,
  romanized: text(1000, 0).nullable().default(null),
});
export type PhraseInput = z.infer<typeof phraseSchema>;
export const conversionSchema = z.object({ base: iso3, quote: iso3, amount: z.number().min(0).max(1e12).default(0) });
export type ConversionInput = z.infer<typeof conversionSchema>;
/** An extra currency on a trip ("KRW · Seoul layover"). */
export const tripCurrencySchema = z.object({ tripId: z.uuid(), code: iso3, label: text(60, 0).nullable().default(null) });
export type TripCurrencyInput = z.infer<typeof tripCurrencySchema>;

/** A traveler (guest or account) on a trip. */
export const travelerSchema = z
  .object({
    tripId: z.uuid(),
    name: text(80),
    email: emailSchema.nullable().default(null),
    phone: text(40, 0).nullable().default(null),
    homeCurrency: iso3.nullable().default(null),
    joiningStart: dateStr.nullable().default(null),
    joiningEnd: dateStr.nullable().default(null),
    joiningNote: text(80, 0).nullable().default(null),
    color: hex.optional(),
  })
  .refine((v) => !v.joiningStart || !v.joiningEnd || v.joiningStart <= v.joiningEnd, { path: ["joiningEnd"], message: "End must be after start" });
export type TravelerInput = z.infer<typeof travelerSchema>;

const money = z.number().min(0).max(1e9);
const billItem = z.object({
  id: shortId,
  name: text(120),
  localName: text(120, 0).nullable().default(null),
  qty: z.number().int().min(1).max(99).default(1),
  unitPrice: money,
  confidence: z.number().min(0).max(1).nullable().default(null),
});
const billParticipant = z.object({
  id: shortId,
  // Traveler ids are uuids in the database and short ids in the demo dataset; the action checks them against the trip either way.
  travelerId: shortId.nullable().default(null),
  name: text(80),
  color: hex.default("#2F5D3A"),
  homeCurrency: iso3.nullable().default(null),
});
/** A whole bill as the editor sends it; row ids are re-minted server-side except for existing rows. */
export const billSchema = z.object({
  billId: z.uuid().nullable().default(null),
  tripId: z.uuid(),
  placeId: z.uuid().nullable().default(null),
  merchant: text(120),
  currency: iso3,
  billDate: dateStr.nullable().default(null),
  taxAmount: money.default(0),
  taxLabel: text(40, 0).nullable().default(null),
  serviceAmount: money.default(0),
  discountAmount: money.default(0),
  roundingUnit: z.number().min(0.01).max(1000).default(1),
  taxMode: z.enum(["proportional", "even"]).default("proportional"),
  paidBy: shortId.nullable().default(null),
  status: z.enum(["draft", "open", "settled"]).default("draft"),
  items: z.array(billItem).min(1).max(80),
  participants: z.array(billParticipant).min(1).max(30),
  shares: z.array(z.object({ itemId: shortId, participantId: shortId })).max(2400),
}).superRefine((b, ctx) => {
  const items = new Set(b.items.map((i) => i.id)), people = new Set(b.participants.map((p) => p.id));
  if (items.size !== b.items.length || people.size !== b.participants.length) ctx.addIssue({ code: "custom", message: "Duplicate ids", path: ["items"] });
  for (const s of b.shares) if (!items.has(s.itemId) || !people.has(s.participantId)) ctx.addIssue({ code: "custom", message: "Share refers to a missing item or person", path: ["shares"] });
  if (b.paidBy && !people.has(b.paidBy)) ctx.addIssue({ code: "custom", message: "Payer must be on the bill", path: ["paidBy"] });
});
export type BillInput = z.infer<typeof billSchema>;

export const profileSchema = z.object({
  displayName: text(80),
  homeCurrency: iso3,
  homeTz: z.string().max(64),
  theme: z.enum(["system", "light", "dark"]),
  marketingOptIn: z.boolean(),
});

// ─── Round 6: profile defaults, settings, Atlas Premium Pass ─────────────────
export const settingsSchema = z.object({
  suggestLocalLanguage: z.boolean(),
  suggestLocalCurrency: z.boolean(),
  showHomeTime: z.boolean(),
  quickAction: z.boolean(),
}).partial();
export const profileDefaultsSchema = z.object({
  homeCurrency: iso3,
  homeTz: z.string().min(1).max(64),
  languages: z.array(langCode).min(1).max(8),
  units: z.enum(["km", "mi"]),
});
export type ProfileDefaultsInput = z.infer<typeof profileDefaultsSchema>;
export const passPlanSchema = z.enum(["trip", "monthly", "yearly"]);
export const paymentMethodSchema = z.enum(["card", "apple_pay", "google_pay"]);
export const purchaseSchema = z.object({ plan: passPlanSchema, tripId: z.uuid().nullable(), method: paymentMethodSchema });
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export const extendSchema = z.object({ tripId: z.uuid(), days: z.number().int().min(1).max(7), method: paymentMethodSchema });
export type ExtendInput = z.infer<typeof extendSchema>;
export const giftCodeSchema = z.string().trim().toLowerCase().regex(/^[a-f0-9]{24}$/, "That doesn't look like a gift code");
export const createGiftSchema = z.object({ tripId: z.uuid(), travelerId: shortId });
