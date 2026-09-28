import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LANGUAGES, activePass, currencyName, markFor, offlinePacks, passSummary, profileDefaultsSchema, profileStats } from "@voya/core";
import { Avatar, PassChip, PassStar } from "@/components/pass";
import { Button, Card, Eyebrow, IconCoin, ListRow, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CAD", "AUD", "SGD", "PHP", "MXN", "CHF", "INR", "THB", "VND"];
const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();
const tzCity = (tz: string) => tz.split("/").pop()?.replace(/_/g, " ") ?? tz;

/** Profile (mockup 6a): who you are, the pass, three stats, the defaults every tool reuses, account rows. */
export default function Profile() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, biometrics, signOut, updateProfile } = useSession();
  const { now, trips, active, bundle, entitlements } = useData();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ homeCurrency: "USD", homeTz: "UTC", languages: ["en"], units: "km" as "km" | "mi" });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  if (!user) return null;
  const openEditor = () => { setDraft({ homeCurrency: user.profile.home_currency, homeTz: user.profile.home_tz, languages: user.profile.languages, units: user.profile.units }); setError(null); setOpen(true); };
  const p = user.profile;
  const pass = activePass(entitlements, active?.id ?? null, now);
  const summary = passSummary(pass, now, active?.local_tz ?? p.home_tz);
  const stats = profileStats(trips);
  const firstMap = bundle ? offlinePacks(bundle).find((x) => x.kind === "map") : null;
  const save = async (next = draft) => {
    const parsed = profileDefaultsSchema.safeParse(next);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the details."); return; }
    try { new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.homeTz }); } catch { setError("That time zone isn't recognised. Use a name like Asia/Tokyo."); return; }
    const err = await updateProfile({ home_currency: parsed.data.homeCurrency, home_tz: parsed.data.homeTz, languages: parsed.data.languages, units: parsed.data.units, locale: parsed.data.languages[0]! });
    if (err) { setError(err); announce(err); return; }
    setError(null); setOpen(false); setStatus("Defaults saved."); announce("Defaults saved.");
  };
  const muted = { fontSize: 13, fontFamily: t.font.bold, color: t.textMuted } as const;
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow="Trip defaults reused by every tool" title="Profile" action={<Button variant="secondary" size="sm" label="Settings" icon={<Ionicons name="settings-outline" size={16} color={t.text} />} onPress={() => router.push("/settings")} />} />
        <Card style={{ padding: 14, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessible accessibilityLabel={`${p.display_name}, ${user.email ?? ""}, ${pass ? summary.title : "Free plan"}`}>
            <Avatar name={p.display_name} size={56} mark={markFor(pass)} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontFamily: t.font.extrabold, color: t.text }}>{p.display_name}</Text>
              <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>{user.email}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}><PassStar size={11} /><Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: t.premiumText }}>{pass ? summary.title : "Free"}</Text></View>
            </View>
          </View>
          <View style={{ flexDirection: "row", borderRadius: 12, backgroundColor: t.canvas }}>
            {[["Trips", stats.trips], ["Saved places", stats.places], ["Countries", stats.countries]].map(([k, v], i) => (
              <View key={k} accessible accessibilityLabel={`${v} ${k}`} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderLeftWidth: i ? 1 : 0, borderLeftColor: t.border }}><Text style={{ fontSize: 20, fontFamily: t.font.extrabold, color: t.text }}>{v}</Text><Text style={{ fontSize: 11.5, fontFamily: t.font.semibold, color: t.textMuted }}>{k}</Text></View>
            ))}
          </View>
        </Card>

        <Eyebrow>Defaults</Eyebrow>
        <Card>
          <ListRow title="Home currency" trailing={<Text style={muted}>{p.home_currency}</Text>} accessibilityLabel={`Home currency ${p.home_currency}, edit`} onPress={openEditor} chevron />
          <ListRow title="Home time zone" trailing={<Text style={muted}>{tzCity(p.home_tz)}</Text>} accessibilityLabel={`Home time zone ${p.home_tz}, edit`} onPress={openEditor} chevron />
          <ListRow title="I speak" trailing={<Text style={muted} numberOfLines={1}>{p.languages.map(langName).join(", ")}</Text>} accessibilityLabel={`I speak ${p.languages.map(langName).join(", ")}, edit`} onPress={openEditor} chevron />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>Units</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Units" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong }}>
              {(["km", "mi"] as const).map((u) => { const on = p.units === u; return <Pressable key={u} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={u === "km" ? "Kilometres" : "Miles"} onPress={() => void updateProfile({ units: u }).then(() => announce(`Units: ${u === "km" ? "kilometres" : "miles"}.`))} style={{ height: 32, minWidth: 44, paddingHorizontal: 10, borderRadius: 9, backgroundColor: on ? t.primary : "transparent", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.textMuted }}>{u}</Text></Pressable>; })}
            </View>
          </View>
          <ListRow title="Sign-in" subtitle={biometrics === "none" ? "Password" : biometrics === "face" ? "Face ID enabled" : "Fingerprint enabled"} last />
        </Card>
        {status ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, fontFamily: t.font.semibold, color: t.primary }}>{status}</Text> : null}

        <Eyebrow>Account</Eyebrow>
        <Card>
          <ListRow onPress={() => router.push("/pass")} leading={<View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: t.premiumBg, alignItems: "center", justifyContent: "center" }}><PassStar size={18} color={t.premiumText} /></View>} title="Atlas Premium Pass" subtitle={pass ? summary.detail : "Split, Navigate trees, Translate and Currency on every trip"} trailing={pass ? <PassChip mark={markFor(pass)}>{markFor(pass) === "gifted" ? "Gifted" : undefined}</PassChip> : <Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.primary }}>Upgrade</Text>} chevron />
          <ListRow onPress={() => router.push("/settings")} leading={<IconCoin name="download-outline" />} title="Offline downloads" subtitle={firstMap ? `${firstMap.title.replace(" map", "")} · ${firstMap.sizeMb} MB` : "Pick a trip to download"} chevron />
          <ListRow onPress={() => router.push("/settings/permissions")} leading={<IconCoin name="lock-closed-outline" />} title="Privacy & data" subtitle="Permissions, legal, download or delete your data" chevron last />
        </Card>
        <Button variant="secondary" label="Sign out" full onPress={() => void signOut()} />

        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: "80%", backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontFamily: t.font.extrabold, color: t.text }}>Trip defaults</Text>
            <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>Home currency</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Home currency" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {[draft.homeCurrency, ...CURRENCIES].filter((c, i, a) => a.indexOf(c) === i).map((c) => { const on = draft.homeCurrency === c; return <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${c}, ${currencyName(c)}`} onPress={() => setDraft({ ...draft, homeCurrency: c })} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: on ? t.primary : t.surface, borderWidth: 1, borderColor: on ? t.primary : t.borderStrong, justifyContent: "center" }}><Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: on ? t.onPrimary : t.text }}>{c}</Text></Pressable>; })}
            </View>
            <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>Home time zone</Text>
            <TextInput accessibilityLabel="Home time zone" value={draft.homeTz} onChangeText={(homeTz) => setDraft({ ...draft, homeTz })} autoCapitalize="none" autoCorrect={false} placeholder="America/New_York" placeholderTextColor={t.textFaint} style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, paddingHorizontal: 14, fontSize: 15, color: t.text, fontFamily: t.font.medium }} />
            <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>I speak</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {LANGUAGES.slice(0, 14).map((l) => { const on = draft.languages.includes(l.code); return <Pressable key={l.code} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={l.name} onPress={() => setDraft({ ...draft, languages: on ? draft.languages.filter((c) => c !== l.code) : [...draft.languages, l.code] })} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: on ? t.primary : t.surface, borderWidth: 1, borderColor: on ? t.primary : t.borderStrong, justifyContent: "center" }}><Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: on ? t.onPrimary : t.text }}>{l.name}</Text></Pressable>; })}
            </View>
            {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 12.5, fontFamily: t.font.semibold }}>{error}</Text> : null}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}><Button variant="ghost" label="Cancel" onPress={() => setOpen(false)} /><Button label="Save" disabled={draft.languages.length === 0} onPress={() => save()} /></View>
          </ScrollView>
        </Modal>
      </ScrollView>
    </View>
  );
}
