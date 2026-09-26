import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { LANGUAGES, type Language, type Translation } from "@voya/core";
import { Button, Card, announce } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** One language pill; opens a modal list of languages as radios. */
function LanguagePill({ side, value, onChange }: { side: "from" | "to"; value: Language; onChange: (code: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${side === "from" ? "From" : "To"}: ${value.name}`} accessibilityHint="Opens the language list" onPress={() => setOpen(true)} style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 12, justifyContent: "center", gap: 2 }}>
        <Text style={{ fontSize: 11, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>{side === "from" ? "From" : "To"}</Text>
        <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{value.native}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ maxHeight: "70%", backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>{side === "from" ? "Translate from" : "Translate to"}</Text>
          <ScrollView>
            <Card>
              <View accessibilityRole="radiogroup" accessibilityLabel="Language">
                {LANGUAGES.map((l, i) => {
                  const on = l.code === value.code;
                  return (
                    <Pressable key={l.code} accessibilityRole="radio" accessibilityLabel={`${l.name}, ${l.native}`} accessibilityState={{ checked: on }} onPress={() => { onChange(l.code); setOpen(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 52, backgroundColor: on ? t.surfaceTint : "transparent", borderBottomWidth: i === LANGUAGES.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                      <Text style={{ flex: 1, fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{l.native}</Text>
                      <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>{l.name}</Text>
                      {on && <Ionicons name="checkmark" size={18} color={t.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/** From ⇄ To with a swap button and the trip suggestion underneath. */
export function LanguageBar({ from, to, reason, onChange, onSwap }: { from: Language; to: Language; reason: string | null; onChange: (side: "from" | "to", code: string) => void; onSwap: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LanguagePill side="from" value={from} onChange={(c) => onChange("from", c)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Swap languages" onPress={onSwap} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="swap-horizontal" size={20} color={t.text} /></Pressable>
        <LanguagePill side="to" value={to} onChange={(c) => onChange("to", c)} />
      </View>
      {reason ? <Text style={{ fontSize: 12, fontFamily: t.font.semibold, color: t.primary }}>{reason}</Text> : null}
    </View>
  );
}

/** Text-to-speech via expo-speech. */
export function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    try { Speech.speak(text, { language: lang, onDone: () => resolve(), onError: () => resolve(), onStopped: () => resolve() }); } catch { resolve(); }
  });
}

export function SpeakButton({ text, lang, label = "Speak", variant = "light", style }: { text: string; lang: string; label?: string; variant?: "light" | "ink" | "secondary"; style?: object }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const fg = variant === "light" ? "#121614" : variant === "ink" ? t.onInk : t.text;
  return <Button variant={variant} size="sm" label={label} icon={<Ionicons name="volume-high-outline" size={16} color={fg} />} accessibilityState={{ busy }} disabled={!text} style={style} onPress={async () => { setBusy(true); await speak(text, lang); setBusy(false); }} />;
}

export function CopyButton({ text, onDone }: { text: string; onDone?: (message: string) => void }) {
  return <Button variant="light" size="sm" label="Copy" icon={<Ionicons name="copy-outline" size={16} color="#121614" />} disabled={!text} onPress={async () => { const ok = await Clipboard.setStringAsync(text); const m = ok ? "Copied" : "Couldn't copy"; announce(m); onDone?.(m); }} />;
}

/** The green translation card: big target text, romanisation, Speak / Copy / save slot. */
export function ResultCard({ result, to, children }: { result: Translation; to: Language; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View accessible={false} style={{ backgroundColor: t.primary, borderRadius: 16, padding: 18, gap: 10 }}>
      <Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.onPrimary, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.6 }}>{to.native}</Text>
      <Text accessibilityLanguage={to.speech} style={{ fontSize: 28, lineHeight: 36, fontFamily: t.font.extrabold, color: t.onPrimary, letterSpacing: -0.3 }}>{result.text}</Text>
      {result.romanized ? <Text style={{ fontSize: 15, fontFamily: t.font.medium, color: t.onPrimary, opacity: 0.9 }}>{result.romanized}</Text> : null}
      {result.approximate ? <Text accessibilityRole="text" style={{ fontSize: 12.5, lineHeight: 17, fontFamily: t.font.semibold, color: t.onPrimary, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>Demo mode: this phrase isn&apos;t in the offline phrasebook, so it&apos;s shown as typed. Connect a translation provider for live results.</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <SpeakButton text={result.text} lang={to.speech} />
        <CopyButton text={result.text} />
        {children}
      </View>
    </View>
  );
}
