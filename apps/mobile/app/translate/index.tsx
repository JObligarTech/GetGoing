import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { contextPhrases, languageByCode, localDate, phrasesForTrip, suggestLanguages, translateSchema, tripDayNumber, type ContextPhrase, type Language, type Phrase, type Translation } from "@voya/core";
import { LanguageBar, ResultCard } from "@/components/translate";
import { Button, Card, Chip, EmptyState, Eyebrow, IconCoin, ListRow, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { translation } from "@/lib/providers";
import { PermissionSheet } from "@/components/PermissionSheet";
import { markPrompt, needsPrompt, useOnline } from "@/lib/offline";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const MAX = 500;
const CONTEXT_ICON: Record<ContextPhrase["kind"], "car-outline" | "sparkles-outline" | "camera-outline"> = { driver: "car-outline", phrase: "sparkles-outline", camera: "camera-outline" };
type Result = Translation & { sourceText: string; from: string; to: string };

/**
 * Translate — text mode. The pair opens on the trip's language, the box auto-translates
 * after a pause, and the result card carries Speak / Copy / Save. Saved phrases are trip chips.
 */
export default function TranslateScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { text: qText } = useLocalSearchParams<{ text?: string }>();
  const { user } = useSession();
  const { now, active, bundle, addPhrase, removePhrase } = useData();
  // The pair follows the active trip (which loads async); user changes are kept per trip.
  const suggested = suggestLanguages(active, user?.profile ?? null);
  const [langs, setLangs] = useState<{ key: string | null; from: Language; to: Language; reason: string | null } | null>(null);
  const cur = langs && langs.key === (active?.id ?? null) ? langs : { key: active?.id ?? null, from: suggested.from, to: suggested.to, reason: suggested.reason };
  const { from, to, reason } = cur;
  const setPair = (next: Partial<{ from: Language; to: Language; reason: string | null }>) => setLangs({ ...cur, ...next });
  const [text, setText] = useState(qText?.slice(0, MAX) ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [askMic, setAskMic] = useState(false);
  const online = useOnline();

  const run = async (input: string, f: Language, tt: Language) => {
    const parsed = translateSchema.safeParse({ text: input, from: f.code, to: tt.code });
    if (!parsed.success) { setResult(null); return; }
    setBusy(true);
    try {
      const r = await translation.translate(parsed.data.text, f.code, tt.code);
      setResult({ ...r, sourceText: parsed.data.text, from: f.code, to: tt.code });
      setStatus({});
    } catch { setStatus({ error: "Translation is unavailable right now." }); } finally { setBusy(false); }
  };
  // Auto-translate after a pause in typing.
  useEffect(() => {
    if (!text.trim()) return;
    const h = setTimeout(() => { void run(text, from, to); }, 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, from.code, to.code]);

  if (!user || !active || !bundle) {
    return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><PageHeader eyebrow="Translate" title="No active trip" /><EmptyState title="Create a trip first" body="Translate suggests the trip's language and keeps saved phrases with the trip." /></View></View>;
  }
  const tz = active.local_tz ?? user.profile.home_tz;
  const today = localDate(now, tz);
  const day = tripDayNumber(active, today) ? today : active.start_date ?? today;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const context = contextPhrases(bundle, day, hhmm);
  const phrases = phrasesForTrip(bundle);
  const saved = result ? phrases.find((p) => p.source_text === result.sourceText && p.target_lang === result.to) ?? null : null;

  const changeLang = (side: "from" | "to", code: string) => {
    const l = languageByCode(code); if (!l) return;
    if (side === "from") setPair({ from: l, to: l.code === to.code ? from : to, reason: null });
    else setPair({ to: l, from: l.code === from.code ? to : from, reason: null });
  };
  const swap = () => {
    const next = result && !result.approximate ? result.text : text;
    setPair({ from: to, to: from, reason: null }); setText(next); setResult(null);
    announce(`Now translating ${to.name} to ${from.name}.`);
  };
  const load = (p: Phrase) => {
    const f = languageByCode(p.source_lang) ?? from, tt = languageByCode(p.target_lang) ?? to;
    setPair({ from: f, to: tt, reason: null }); setText(p.source_text);
    setResult({ text: p.target_text, romanized: p.romanized ?? undefined, source: "live", sourceText: p.source_text, from: f.code, to: tt.code });
  };
  const save = async () => {
    if (!result || result.approximate) return;
    const r = await addPhrase({ sourceText: result.sourceText, sourceLang: result.from, targetText: result.text, targetLang: result.to, romanized: result.romanized ?? null });
    if ("error" in r) { setStatus({ error: r.error }); announce(r.error); return; }
    const ok = `Saved "${r.source_text}" to ${active.name}.`; setStatus({ ok }); announce(ok);
  };
  const remove = async (p: Phrase) => {
    const r = await removePhrase(p.id);
    if ("error" in r) { setStatus({ error: r.error }); return; }
    const ok = `Removed "${p.source_text}".`; setStatus({ ok }); announce(ok);
  };
  const micUnavailable = () => { const m = "Voice input needs a speech-recognition module in a development build. Type instead, or use Conversation with the other person typing."; setStatus({ error: m }); announce(m); };
  const mic = () => { if (!online) { const m = "Speech needs internet. Type instead, or show the phrase."; setStatus({ error: m }); announce(m); return; } if (needsPrompt("microphone")) setAskMic(true); else micUnavailable(); };
  const enter = (i: number) => (reduce ? undefined : FadeInDown.duration(220).delay(i * 40));

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: 120 }]} keyboardShouldPersistTaps="handled">
        <Animated.View entering={enter(0)}><PageHeader eyebrow={active.name} title="Translate" action={online ? <Chip>{to.native} ready</Chip> : <Chip tone="plain">Offline</Chip>} /></Animated.View>
        <PermissionSheet cap="microphone" context={to.name} visible={askMic} onAllow={() => { markPrompt("microphone", true); setAskMic(false); micUnavailable(); }} onDecline={() => { markPrompt("microphone", false); setAskMic(false); }} />
        {!online && (
          <Card accessibilityLabel="Unavailable right now">
            <Text style={{ paddingHorizontal: 14, paddingTop: 10, fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>Unavailable right now · text translation works offline</Text>
            <ListRow title="Voice & Conversation" subtitle="Type instead, or show the phrase" />
            <ListRow title="Camera translation" subtitle="Photos are saved and translated when you're back online" />
            <ListRow title="Split receipt scan" subtitle="Snap now, split later" last />
          </Card>
        )}
        <Animated.View entering={enter(1)}><LanguageBar from={from} to={to} reason={reason} onChange={changeLang} onSwap={swap} /></Animated.View>

        <Animated.View entering={enter(2)}>
          <Card style={{ padding: 14, gap: 10 }}>
            <TextInput accessibilityLabel="Text to translate" accessibilityHint={`${MAX - text.length} characters left`} value={text} onChangeText={(v) => setText(v.slice(0, MAX))} multiline maxLength={MAX} placeholder={`Type in ${from.name}…`} placeholderTextColor={t.textFaint} textAlignVertical="top" style={{ minHeight: 110, fontSize: 17, lineHeight: 24, color: t.text, fontFamily: t.font.regular, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, padding: 12 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: t.font.semibold, color: MAX - text.length < 40 ? t.danger : t.textMuted }}>{text.length} / {MAX}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button variant="secondary" size="sm" label="Voice" accessibilityLabel="Voice input" icon={<Ionicons name="mic-outline" size={16} color={t.text} />} onPress={mic} />
                <Button size="sm" label="Translate" disabled={!text.trim() || busy} onPress={() => run(text, from, to)} />
              </View>
            </View>
          </Card>
        </Animated.View>

        {status.error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{status.error}</Text> : null}
        {status.ok ? <Text accessibilityLiveRegion="polite" style={{ color: t.primary, fontSize: 13, fontFamily: t.font.semibold }}>{status.ok}</Text> : null}

        {result && (
          <Animated.View entering={reduce ? undefined : FadeInDown.duration(220)} accessibilityLabel={`Translation to ${to.name}`}>
            <ResultCard result={result} to={to}>
              {saved ? (
                <Button variant="light" size="sm" label="Remove from saved" icon={<Ionicons name="trash-outline" size={16} color="#121614" />} onPress={() => remove(saved)} />
              ) : (
                <Button variant="light" size="sm" label="Save phrase" icon={<Ionicons name="bookmark-outline" size={16} color="#121614" />} disabled={!!result.approximate} onPress={save} />
              )}
            </ResultCard>
          </Animated.View>
        )}

        <View style={{ gap: 8 }}>
          <Eyebrow>Saved phrases</Eyebrow>
          {phrases.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {phrases.map((p) => {
                const on = p.id === saved?.id;
                return (
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.source_text} accessibilityState={{ selected: on }} onPress={() => load(p)} style={{ height: 40, borderRadius: 20, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: on ? t.primary : t.borderStrong, backgroundColor: on ? t.primary : t.surface }}>
                    <Ionicons name={on ? "bookmark" : "bookmark-outline"} size={14} color={on ? t.onPrimary : t.text} />
                    <Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.text }}>{p.source_text}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Translate something and tap Save phrase to keep it here.</Text>}
        </View>

        <View style={{ gap: 8 }}>
          <Eyebrow>From your trip</Eyebrow>
          <Card>
            {context.map((c, i) => (
              <ListRow key={c.key} last={i === context.length - 1} leading={<IconCoin name={CONTEXT_ICON[c.kind]} />} title={c.label} subtitle={c.detail} chevron onPress={() => {
                if (c.kind === "driver") router.push({ pathname: "/translate/driver", params: { place: c.placeId! } });
                else if (c.kind === "camera") router.push("/translate/camera");
                else { setText(c.text ?? ""); announce(`Translating "${c.text}".`); }
              }} />
            ))}
          </Card>
          <Text style={{ fontSize: 12, lineHeight: 16, color: t.textMuted, fontFamily: t.font.regular }}>Saved phrases belong to the trip, so everyone travelling with you sees them.</Text>
        </View>
      </ScrollView>

      <View accessibilityRole="toolbar" accessibilityLabel="Translate modes" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 16, flexDirection: "row", alignItems: "center", backgroundColor: t.surfaceRaised, borderRadius: 18, padding: 8, gap: 8, borderWidth: 1, borderColor: t.border, shadowColor: "#000", shadowOpacity: t.scheme === "dark" ? 0.4 : 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Conversation" onPress={() => router.push("/translate/conversation")} style={{ flex: 1, height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}><Ionicons name="chatbubbles-outline" size={18} color={t.text} /><Text style={{ fontSize: 14, fontFamily: t.font.bold, color: t.text }}>Conversation</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Speak in ${from.name}`} onPress={mic} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" }}><Ionicons name="mic" size={24} color={t.onPrimary} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Camera" onPress={() => router.push("/translate/camera")} style={{ flex: 1, height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}><Ionicons name="camera-outline" size={18} color={t.text} /><Text style={{ fontSize: 14, fontFamily: t.font.bold, color: t.text }}>Camera</Text></Pressable>
      </View>
    </View>
  );
}
