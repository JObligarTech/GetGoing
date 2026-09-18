import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { DEMO_USER_ID, demoProfile, signInSchema, type Profile } from "@voya/core";
import { getSupabase, isDemo, prefs } from "./supabase";

export interface SessionUser { id: string; email: string | null; profile: Profile }
export interface RememberedUser { name: string; email: string }

interface SessionState {
  ready: boolean;
  user: SessionUser | null;
  remembered: RememberedUser | null;
  /** Face ID / fingerprint available and enrolled on this device. */
  biometrics: "none" | "face" | "fingerprint";
  signIn(email: string, password: string): Promise<string | null>;
  /** Re-enter an existing session after a biometric check (the "Welcome back" screen). */
  unlockWithBiometrics(): Promise<boolean>;
  signOut(): Promise<void>;
  forgetRemembered(): Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);
const DEMO = { email: "joe@example.com", password: "VoyaDemo-2027!" };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [remembered, setRemembered] = useState<RememberedUser | null>(null);
  const [biometrics, setBiometrics] = useState<SessionState["biometrics"]>("none");
  // A valid session exists but is locked behind biometrics until the user confirms.
  const [locked, setLocked] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await prefs.get("remembered");
        if (raw && !cancelled) setRemembered(JSON.parse(raw));
        const hw = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
        if (hw) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (!cancelled) setBiometrics(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? "face" : "fingerprint");
        }
        if (!isDemo) {
          const sb = await getSupabase();
          const { data } = await sb.auth.getSession();
          if (data.session && !cancelled) {
            const { data: profile } = await sb.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
            if (profile) setLocked({ id: data.session.user.id, email: data.session.user.email ?? null, profile });
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const remember = useCallback(async (name: string, email: string) => {
    const r = { name, email };
    setRemembered(r);
    await prefs.set("remembered", JSON.stringify(r));
  }, []);

  const signIn = useCallback<SessionState["signIn"]>(async (email, password) => {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return "Enter your email and password.";
    if (isDemo) {
      if (parsed.data.email !== DEMO.email || password !== DEMO.password) return "Email or password is incorrect.";
      setUser({ id: DEMO_USER_ID, email: DEMO.email, profile: demoProfile });
      await remember("Joe", DEMO.email);
      return null;
    }
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signInWithPassword(parsed.data);
    if (error || !data.user) return "Email or password is incorrect.";
    const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
    if (!profile) return "Couldn't load your profile.";
    setUser({ id: data.user.id, email: data.user.email ?? null, profile });
    await remember(profile.display_name, parsed.data.email);
    return null;
  }, [remember]);

  const unlockWithBiometrics = useCallback(async () => {
    if (biometrics === "none") return false;
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Voya", cancelLabel: "Use password", disableDeviceFallback: true });
    if (!res.success) return false;
    if (isDemo) {
      setUser({ id: DEMO_USER_ID, email: DEMO.email, profile: demoProfile });
      return true;
    }
    if (locked) { setUser(locked); setLocked(null); return true; }
    return false;
  }, [biometrics, locked]);

  const signOut = useCallback(async () => {
    if (!isDemo) await (await getSupabase()).auth.signOut();
    setUser(null);
    setLocked(null);
  }, []);

  const forgetRemembered = useCallback(async () => {
    setRemembered(null);
    await prefs.del("remembered");
  }, []);

  const value = useMemo<SessionState>(() => ({ ready, user, remembered, biometrics, signIn, unlockWithBiometrics, signOut, forgetRemembered }), [ready, user, remembered, biometrics, signIn, unlockWithBiometrics, signOut, forgetRemembered]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
