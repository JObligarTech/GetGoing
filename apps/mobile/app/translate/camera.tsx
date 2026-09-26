import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { convert, formatMoney, suggestLanguages, translateLines, type CachedRate, type CameraLine } from "@voya/core";
import { Button, Card, Chip, EmptyState, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { fx, ocr, translation } from "@/lib/providers";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

type View3 = "overlay" | "text";
const SAMPLE = [["AFURI 原宿", 0.06], ["柚子塩らーめん  ¥1,200", 0.22], ["つけ麺  ¥1,350", 0.36], ["餃子 5個  ¥600", 0.5], ["チャーシュー追加  ¥300", 0.64], ["小麦・大豆・卵を含む", 0.82]] as const;

/**
 * Camera translation: take or choose a photo, read it with the OCR provider on the device
 * and translate each line. Overlay draws chips over the photo; Text lists them with prices
 * in the trip's currency and the home equivalent. Photos are never uploaded or kept.
 */
export default function CameraScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { active } = useData();
  const pair = suggestLanguages(active, user?.profile ?? null);
  const from = pair.to, to = pair.from; // the trip's language is what the camera reads
  const [image, setImage] = useState<{ uri: string | null; alt: string } | null>(null);
  const [lines, setLines] = useState<CameraLine[] | null>(null);
  const [view, setView] = useState<View3>("overlay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<CachedRate | null>(null);
  const local = active?.local_currency ?? null, home = user?.profile.home_currency ?? "USD";

  useEffect(() => {
    if (!local || local === home) return;
    let alive = true;
    fx.rate(local, home).then((r) => { if (alive) setRate(r); }).catch(() => {});
    return () => { alive = false; };
  }, [local, home]);

  if (!active || !user) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;

  const read = async (uri: string | null, alt: string) => {
    setImage({ uri, alt }); setLines(null); setError(null); setBusy(true); announce("Reading the photo…");
    try {
      // The file's bytes go to the provider and nowhere else; the mock ignores them, a real provider needs them.
      const bytes = uri ? await fetch(uri).then((r) => r.arrayBuffer()).catch(() => new ArrayBuffer(0)) : new ArrayBuffer(0);
      const raw = await ocr.recognize(bytes, { languageHints: [from.code] });
      const out = await translateLines(raw, from.code, to.code, translation);
      setLines(out);
      announce(`Found ${out.length} lines. ${out.filter((l) => l.price != null).length} have prices.`);
    } catch { setError("Couldn't read that photo. Try a sharper one with more light."); } finally { setBusy(false); }
  };
  const pick = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError(camera ? "Camera permission was denied. Allow it in Settings to translate with the camera." : "Photo access was denied. Allow it in Settings to choose a photo."); return; }
      const res = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      const asset = res.canceled ? null : res.assets?.[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) { setError("Photos up to 8 MB, please."); return; }
      await read(asset.uri, "Your photo");
    } catch { setError("Couldn't open the camera or photos on this device."); }
  };
  const price = (n: number | null) => {
    if (n == null || !local) return null;
    const a = formatMoney(n, local);
    return rate && rate.quote !== local ? `${a} ≈ ${formatMoney(convert(n, rate.rate, rate.quote), rate.quote)}` : a;
  };
  const overlayLabel = (l: CameraLine) => `${l.translated || l.original}${l.price != null ? `, ${price(l.price)}` : ""}, originally ${l.original}`;
  const seg = (v: View3, label: string) => {
    const on = view === v;
    return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={() => setView(v)} style={{ height: 40, minWidth: 72, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.primary : "transparent" }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.textMuted }}>{label}</Text></Pressable>;
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Translate" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{active.name}</Text>
            <Text accessibilityRole="header" style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>Camera</Text>
          </View>
          <Chip>{from.native} → {to.native}</Chip>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View accessibilityRole="radiogroup" accessibilityLabel="View" style={{ flexDirection: "row", gap: 4, backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, padding: 4 }}>{seg("overlay", "Overlay")}{seg("text", "Text")}</View>
          <View accessible accessibilityLabel="Live, coming soon" accessibilityState={{ disabled: true }} style={{ height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: t.borderStrong, flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.textMuted }}>Live</Text><Chip tone="premium">Soon</Chip></View>
        </View>

        <View accessible={!lines} accessibilityRole={image ? "image" : undefined} accessibilityLabel={image?.alt} style={{ aspectRatio: 3 / 4, maxHeight: 520, borderRadius: 18, borderWidth: 1, borderColor: t.border, backgroundColor: t.mapBg, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          {image ? (
            <View style={{ flex: 1, alignSelf: "stretch" }}>
              {image.uri ? <Image source={{ uri: image.uri }} resizeMode="contain" style={{ flex: 1 }} accessibilityIgnoresInvertColors /> : (
                <View style={{ flex: 1, backgroundColor: "#F3EEE2", padding: 24 }} accessible={false}>
                  {SAMPLE.map(([line, y]) => <Text key={line} style={{ position: "absolute", left: 24, top: `${y * 100}%`, fontSize: 20, color: "#2A2622" }}>{line}</Text>)}
                </View>
              )}
              {lines && view === "overlay" && (
                <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} accessibilityLabel="Translated lines over the photo">
                  {lines.map((l, i) => l.box && (
                    <View key={i} accessible accessibilityLabel={overlayLabel(l)} style={{ position: "absolute", left: `${l.box[0] * 100}%`, top: `${l.box[1] * 100}%`, maxWidth: `${(1 - l.box[0]) * 100 - 4}%`, backgroundColor: "rgba(18,22,20,0.88)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      <Text style={{ color: "#F1F3EF", fontSize: 13, fontFamily: t.font.bold }}>{l.translated || l.original}</Text>
                      {l.price != null ? <Text style={{ color: "#C9D3CC", fontSize: 13, fontFamily: t.font.bold }}>{price(l.price)}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
              {busy ? <Text accessibilityLiveRegion="polite" style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,22,20,0.8)", color: "#F1F3EF", textAlign: "center", paddingVertical: 8, fontSize: 13, fontFamily: t.font.bold }}>Reading the photo…</Text> : null}
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 10, padding: 24 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.surfaceTint, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera-outline" size={26} color={t.primary} /></View>
              <Text style={{ fontSize: 16, fontFamily: t.font.bold, color: t.text, textAlign: "center" }}>Point it at a menu, a sign or a receipt</Text>
              <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular, textAlign: "center" }}>The photo is read on this device and thrown away. Nothing is stored.</Text>
            </View>
          )}
        </View>

        {lines && !busy ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.primary }}>Found {lines.length} lines. {lines.filter((l) => l.price != null).length} have prices.</Text> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{error}</Text> : null}

        {lines && view === "text" && (
          <Card>
            {lines.map((l, i) => (
              <View key={i} accessible accessibilityLabel={`${l.translated || l.original}${l.price != null ? `, ${price(l.price)}` : ""}. Originally ${l.original}${l.confidence < 0.7 ? ", low confidence" : ""}`} style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === lines.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{l.translated || l.original}</Text>
                  <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>{l.original}{l.confidence < 0.7 ? " · low confidence" : ""}</Text>
                </View>
                {l.price != null ? <Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.text, textAlign: "right" }}>{price(l.price)}</Text> : null}
              </View>
            ))}
          </Card>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button variant="secondary" label="Choose photo" icon={<Ionicons name="image-outline" size={18} color={t.text} />} style={{ flexGrow: 1, flexBasis: "45%" }} onPress={() => pick(false)} />
          <Button variant="ink" label="Take photo" icon={<Ionicons name="camera-outline" size={18} color={t.onInk} />} style={{ flexGrow: 1, flexBasis: "45%" }} onPress={() => pick(true)} />
          <Button variant="secondary" label="Try a sample menu" icon={<Ionicons name="sparkles-outline" size={18} color={t.text} />} style={{ flexGrow: 1, flexBasis: "45%" }} disabled={busy} onPress={() => read(null, "Sample menu from Afuri Ramen with five items and an allergen line")} />
          <Button variant="secondary" label="Send to Split" icon={<Ionicons name="receipt-outline" size={18} color={t.text} />} style={{ flexGrow: 1, flexBasis: "45%" }} disabled accessibilityHint="Split arrives in the next round" onPress={() => {}} />
        </View>
        {rate?.stale ? <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>Prices use a cached rate; you seem to be offline.</Text> : null}
      </ScrollView>
    </View>
  );
}
