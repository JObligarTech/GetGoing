"use server";
import { revalidatePath } from "next/cache";
import { profileDefaultsSchema, settingsSchema, updateProfile, type Json } from "@voya/core";
import { demoStore } from "@/lib/demo-store";
import { isDemo } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

/** Trip defaults reused by every tool: home currency, home time zone, languages, units. */
export async function updateDefaultsAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = profileDefaultsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const { homeCurrency, homeTz, languages, units } = parsed.data;
  try { new Intl.DateTimeFormat("en-US", { timeZone: homeTz }); } catch { return { error: "That time zone isn't recognised. Use a name like Asia/Tokyo." }; }
  const patch = { home_currency: homeCurrency, home_tz: homeTz, languages, units, locale: languages[0]! };
  if (isDemo) await demoStore.updateProfile(user.id, patch);
  else {
    try { await updateProfile(await createServerSupabase(), user.id, patch); } catch { return { error: "Couldn't save your defaults." }; }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Trip behaviour toggles (Settings): merged into profile.settings, unknown keys dropped. */
export async function updateSettingsAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the settings." };
  const current = (user.profile.settings && typeof user.profile.settings === "object" && !Array.isArray(user.profile.settings) ? user.profile.settings : {}) as Record<string, Json | undefined>;
  const settings = { ...current, ...parsed.data } as Json;
  if (isDemo) await demoStore.updateProfile(user.id, { settings });
  else {
    try { await updateProfile(await createServerSupabase(), user.id, { settings }); } catch { return { error: "Couldn't save the setting." }; }
  }
  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true };
}

export async function updateThemeAction(theme: unknown): Promise<Result> {
  const user = await requireUser();
  if (theme !== "system" && theme !== "light" && theme !== "dark") return { error: "Pick a theme." };
  if (isDemo) await demoStore.updateProfile(user.id, { theme });
  else {
    try { await updateProfile(await createServerSupabase(), user.id, { theme }); } catch { return { error: "Couldn't save the theme." }; }
  }
  return { ok: true };
}
