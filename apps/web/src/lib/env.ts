import { z } from "zod";

/**
 * Validated environment. Public vars are inlined at build time by Next, so we read
 * them by full name (no dynamic access).
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

/**
 * Demo mode: no Supabase, in-memory data, a cookie-based fake session.
 * Used by e2e tests and local previews. It is refused on a production deployment
 * (VERCEL_ENV / VOYA_ENV = "production") — a deliberate, greppable guard.
 */
export const isDemo = process.env.VOYA_DEMO === "1";
const deployedToProduction = process.env.VERCEL_ENV === "production" || process.env.VOYA_ENV === "production";
if (isDemo && deployedToProduction) {
  throw new Error("VOYA_DEMO=1 is not allowed on a production deployment.");
}
if (!isDemo && (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example), or VOYA_DEMO=1 for demo mode.");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // The web app must never hold the service-role key; RLS is the security boundary.
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must not be present in the web app environment.");
}

export const DEMO_COOKIE = "voya_demo_session";

export const serverEnv = {
  GEOCODE_PROVIDER: process.env.GEOCODE_PROVIDER,
  FX_PROVIDER: process.env.FX_PROVIDER,
  TRANSLATION_PROVIDER: process.env.TRANSLATION_PROVIDER,
  SITE_URL: publicEnv.NEXT_PUBLIC_SITE_URL,
};
