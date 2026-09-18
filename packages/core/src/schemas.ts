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

export const profileSchema = z.object({
  displayName: text(80),
  homeCurrency: iso3,
  homeTz: z.string().max(64),
  theme: z.enum(["system", "light", "dark"]),
  marketingOptIn: z.boolean(),
});
