"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { resetRequestSchema, signInSchema, signUpSchema } from "@voya/core";
import { DEMO_COOKIE, isDemo, publicEnv } from "@/lib/env";
import { DEMO_SID_COOKIE } from "@/lib/demo-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";

/** `values` echoes submitted fields so forms can keep them: React 19 resets uncontrolled inputs after an action. */
export type ActionState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string; values?: Record<string, string> };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

const LAST_USER_COOKIE = "voya_last_user";
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** Only allow same-origin relative paths for post-login redirects. */
function safeNext(raw: FormDataEntryValue | null): Route {
  const v = typeof raw === "string" ? raw : "";
  return (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/home") as Route;
}

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Demo mode: session cookie + an isolated per-browser data sandbox id. */
async function startDemoSession() {
  const store = await cookies();
  store.set(DEMO_COOKIE, "1", { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 });
  store.set(DEMO_SID_COOKIE, crypto.randomUUID(), { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 });
}

async function rememberUser(name: string, email: string) {
  const store = await cookies();
  store.set(LAST_USER_COOKIE, JSON.stringify({ name, email }), { ...cookieOpts, maxAge: 60 * 60 * 24 * 90 });
}

export async function getLastUser(): Promise<{ name: string; email: string } | null> {
  const raw = (await cookies()).get(LAST_USER_COOKIE)?.value;
  if (!raw) return null;
  const parsed = z.object({ name: z.string().max(80), email: z.string().max(254) }).safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: str(formData.get("email")) };
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (!(await checkRateLimit("signin", parsed.data.email))) return { error: "Too many attempts. Try again in a minute.", values };
  const next = safeNext(formData.get("next"));

  if (isDemo) {
    if (parsed.data.email !== "joe@example.com" || parsed.data.password !== "VoyaDemo-2027!") return { error: "Email or password is incorrect.", values };
    await startDemoSession();
    await rememberUser("Joe", parsed.data.email);
    redirect(next);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for unknown email / wrong password: no account enumeration.
  if (error || !data.user) return { error: "Email or password is incorrect.", values };
  const name = (data.user.user_metadata?.display_name as string | undefined) ?? parsed.data.email.split("@")[0]!;
  await rememberUser(name, parsed.data.email);
  redirect(next);
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { displayName: str(formData.get("displayName")), email: str(formData.get("email")), dateOfBirth: str(formData.get("dateOfBirth")) };
  if (!(await checkRateLimit("signup"))) return { error: "Too many attempts. Try again in a minute.", values };
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    dateOfBirth: formData.get("dateOfBirth"),
    acceptTerms: formData.get("acceptTerms") === "on",
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  if (isDemo) {
    await startDemoSession();
    await rememberUser(parsed.data.displayName, parsed.data.email);
    redirect("/home");
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      // Date of birth is checked here and not stored — data minimisation.
      data: { display_name: parsed.data.displayName, marketing_opt_in: parsed.data.marketingOptIn },
    },
  });
  if (error) return { error: error.message.includes("already") ? "Check your inbox — if you already have an account we've sent a sign-in link." : "Couldn't create the account. Try again.", values };
  await rememberUser(parsed.data.displayName, parsed.data.email);
  return { ok: true, message: "Check your email to confirm your account." };
}

export async function requestReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await checkRateLimit("reset"))) return { error: "Too many attempts. Try again in a minute." };
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!isDemo) {
    const supabase = await createServerSupabase();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/profile` });
  }
  // Always the same response — no account enumeration.
  return { ok: true, message: "If that email has an account, a reset link is on its way." };
}

export async function signInWithProvider(provider: "apple" | "google", formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (isDemo) {
    await startDemoSession();
    await rememberUser("Joe", "joe@example.com");
    redirect(next);
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url as Route);
}

export async function signOut() {
  const store = await cookies();
  if (isDemo) {
    store.delete(DEMO_COOKIE);
    store.delete(DEMO_SID_COOKIE);
  } else {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/welcome");
}

/** "Not Joe? Switch account" — forget the remembered user. */
export async function forgetLastUser() {
  (await cookies()).delete(LAST_USER_COOKIE);
  redirect("/login");
}

export async function deleteAccount() {
  const h = await headers();
  if (h.get("sec-fetch-site") === "cross-site") redirect("/profile");
  if (isDemo) {
    const store = await cookies();
    store.delete(DEMO_COOKIE);
    store.delete(DEMO_SID_COOKIE);
    redirect("/welcome?deleted=1");
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect("/profile?error=delete");
  await supabase.auth.signOut();
  redirect("/welcome?deleted=1");
}
