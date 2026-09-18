import * as SecureStore from "expo-secure-store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@voya/core/db";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Demo mode = no backend configured: in-memory data, works in Expo Go with zero setup. */
export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

/**
 * Session storage in the device keychain/keystore. Android SecureStore caps values
 * at 2048 bytes and a Supabase session is larger, so values are chunked.
 */
const CHUNK = 1800;
const secureStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) parts.push((await SecureStore.getItemAsync(`${key}.${i}`)) ?? "");
    return parts.join("");
  },
  async setItem(key: string, value: string) {
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(count));
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

let client: SupabaseClient<Database> | null = null;
export function getSupabase(): SupabaseClient<Database> {
  if (isDemo) throw new Error("Supabase is not configured (demo mode)");
  // Loaded on first use only: keeps demo mode / Expo Go start-up light and avoids touching
  // network globals until a backend is actually configured.
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  client ??= createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  return client;
}

/** Small non-secret preferences (remembered user name/email for "Welcome back", active trip). */
export const prefs = {
  get: (k: string) => SecureStore.getItemAsync(`pref.${k}`),
  set: (k: string, v: string) => SecureStore.setItemAsync(`pref.${k}`, v),
  del: (k: string) => SecureStore.deleteItemAsync(`pref.${k}`),
};
