import "server-only";
import { headers } from "next/headers";

/**
 * Small in-memory token bucket for auth actions — a first line of defence per
 * instance. Supabase enforces its own limits server-side (see supabase/config.toml);
 * for multi-instance deployments put a shared limiter (e.g. Upstash) here.
 */
const buckets = new Map<string, { tokens: number; at: number }>();
// Tunable for load/e2e runs (VOYA_RATE_LIMIT_CAPACITY=1000); defaults are deliberately strict.
const CAPACITY = Number(process.env.VOYA_RATE_LIMIT_CAPACITY) || 8;
const REFILL_MS = 60_000;

/** `subject` (e.g. the email being signed in) narrows the bucket so shared NATs don't collide. */
export async function checkRateLimit(scope: string, subject = ""): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${scope}:${ip}:${subject.toLowerCase()}`;
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: CAPACITY, at: now };
  b.tokens = Math.min(CAPACITY, b.tokens + ((now - b.at) / REFILL_MS) * CAPACITY);
  b.at = now;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.clear(); // crude memory cap
  return true;
}
