import { useRef, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { conversationStrings, detectSide, suggestLanguages, type Translation } from "@voya/core";
import { speak } from "@/components/translate";
import { Button, EmptyState, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { translation } from "@/lib/providers";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

interface Turn { id: number; side: "from" | "to"; text: string; translated: string; romanized?: string; approximate?: boolean }

/**
 * Conversation mode: the top half is turned 180° toward the other person and labelled in
 * their language. Expo Go has no speech recognition, so both sides type; every turn is
 * translated and read aloud in the other language.
 */
export default function ConversationScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { active } = useData();
  const pair = suggestLanguages(active, user?.profile ?? null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typed, setTyped] = useState("");
  const [autoDetect, setAutoDetect] = useState(true);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const { from, to } = pair;
  const theirs = conversationStrings(to.code), mine = conversationStrings(from.code);

  if (!active) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;

  const say = async (side: "from" | "to", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const src = side === "from" ? from : to, dst = side === "from" ? to : from;
    setBusy(true);
    try {
      const r: Translation = await translation.translate(trimmed, src.code, dst.code);
      setTurns((list) => [...list, { id: ++seq.current, side, text: trimmed, translated: r.text, romanized: r.romanized, approximate: r.approximate }]);
      setError(null);
      announce(`${side === "from" ? to.name : from.name}: ${r.text}`);
      if (!muted && !r.approximate) void speak(r.text, dst.speech);
    } catch { setError("Translation is unavailable right now."); } finally { setBusy(false); }
  };
  const submit = () => { const side = autoDetect ? detectSide(typed, pair) : "from"; void say(side, typed); setTyped(""); };
  const micHint = () => { const m = "Voice input needs a speech-recognition module in a development build. Type instead."; setError(m); announce(m); };
  const lastForThem = [...turns].reverse().find((x) => x.side === "from");
  const lastForMe = [...turns].reverse().find((x) => x.side === "to");

  return (
    <View style={s.screen}>
      {/* Their half, rotated toward the person across the table. */}
      <View accessible={false} accessibilityLabel={`${to.name} side, facing the other person`} style={{ flex: 1, transform: [{ rotate: "180deg" }], backgroundColor: "#121614", paddingTop: insets.bottom + 16, paddingHorizontal: 20, paddingBottom: 16, justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#C9D3CC", fontSize: 13, fontFamily: t.font.bold }}>{to.native}</Text>
          <Text accessibilityLiveRegion="polite" style={{ color: "#C9D3CC", fontSize: 13, fontFamily: t.font.bold }}>{theirs.tapToSpeak}</Text>
        </View>
        <View style={{ alignItems: "center", gap: 6 }} accessible accessibilityLanguage={to.speech} accessibilityLabel={lastForThem ? lastForThem.translated : theirs.tapToSpeak}>
          {lastForThem ? (
            <>
              <Text style={{ color: "#F1F3EF", fontSize: 30, lineHeight: 38, fontFamily: t.font.extrabold, textAlign: "center" }}>{lastForThem.translated}</Text>
              {lastForThem.romanized ? <Text style={{ color: "#C9D3CC", fontSize: 15, fontFamily: t.font.regular, textAlign: "center" }}>{lastForThem.romanized}</Text> : null}
            </>
          ) : <Text style={{ color: "#98A39C", fontSize: 18, fontFamily: t.font.regular }}>{theirs.tapToSpeak}</Text>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${theirs.speak} (${to.name})`} onPress={micHint} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#F1F3EF", alignItems: "center", justifyContent: "center" }}><Ionicons name="mic" size={30} color="#121614" /></Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: t.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.border, gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={{ height: 40, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="close" size={18} color={t.text} /><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.text }}>Close</Text></Pressable>
        <Text style={{ backgroundColor: t.surfaceTint, color: t.onTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, fontSize: 12.5, fontFamily: t.font.bold }}>{from.native} ⇄ {to.native}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: autoDetect ? t.primary : t.textMuted }}>Auto-detect {autoDetect ? "on" : "off"}</Text>
          <Switch accessibilityLabel="Auto-detect language" value={autoDetect} onValueChange={setAutoDetect} trackColor={{ true: t.primary, false: t.borderStrong }} />
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute spoken translations" : "Mute spoken translations"} accessibilityState={{ selected: muted }} onPress={() => setMuted((m) => !m)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Ionicons name={muted ? "volume-mute-outline" : "volume-high-outline"} size={18} color={t.text} /></Pressable>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 12, justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: t.textMuted, fontSize: 13, fontFamily: t.font.bold }}>{active.name}</Text>
          <Text accessibilityLiveRegion="polite" style={{ color: t.textMuted, fontSize: 13, fontFamily: t.font.bold }}>{busy ? "Translating…" : mine.tapToSpeak}</Text>
        </View>
        <View style={{ alignItems: "center", gap: 6 }} accessible accessibilityLabel={lastForMe ? `${to.name} said: ${lastForMe.translated}` : mine.tapToSpeak}>
          {lastForMe ? (
            <>
              <Text style={{ color: t.textMuted, fontSize: 13, fontFamily: t.font.semibold, textAlign: "center" }}>{lastForMe.text}</Text>
              <Text style={{ color: t.text, fontSize: 30, lineHeight: 38, fontFamily: t.font.extrabold, textAlign: "center" }}>{lastForMe.translated}</Text>
              {lastForMe.approximate ? <Text style={{ color: t.textMuted, fontSize: 12.5, fontFamily: t.font.semibold, textAlign: "center" }}>Demo mode: shown as typed; connect a translation provider for live results.</Text> : null}
            </>
          ) : <Text style={{ color: t.textMuted, fontSize: 18, fontFamily: t.font.regular }}>{mine.tapToSpeak}</Text>}
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold, textAlign: "center" }}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`${mine.speak} (${from.name})`} onPress={micHint} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" }}><Ionicons name="mic" size={30} color={t.onPrimary} /></Pressable>
        <View style={{ width: "100%", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput accessibilityLabel={mine.typeInstead} value={typed} onChangeText={setTyped} onSubmitEditing={submit} returnKeyType="send" placeholder={mine.typeInstead} placeholderTextColor={t.textFaint} maxLength={500} style={{ flex: 1, height: 48, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, paddingHorizontal: 14, color: t.text, fontFamily: t.font.regular, fontSize: 15, backgroundColor: t.surface }} />
          <Button label="Send" icon={<Ionicons name="send-outline" size={16} color={t.onPrimary} />} disabled={!typed.trim() || busy} onPress={submit} />
        </View>
      </View>

      {turns.length > 0 && (
        <ScrollView style={{ maxHeight: 140, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.surface }} contentContainerStyle={{ padding: 12, gap: 6 }}>
          <Text accessibilityRole="header" style={{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Transcript</Text>
          {turns.map((x) => (
            <Text key={x.id} accessibilityLabel={`${x.side === "from" ? "You" : to.name}: ${x.text}, translated as ${x.translated}`} style={{ fontSize: 13, color: t.text, fontFamily: t.font.regular }}>
              <Text style={{ fontFamily: t.font.bold, color: t.textMuted }}>{x.side === "from" ? "You" : to.name}  </Text>{x.text} → <Text style={{ fontFamily: t.font.semibold }}>{x.translated}</Text>
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
