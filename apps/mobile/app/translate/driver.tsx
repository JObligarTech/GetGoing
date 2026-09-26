import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { driverCard, languageByCode } from "@voya/core";
import { SpeakButton } from "@/components/translate";
import { Button, EmptyState, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useTheme } from "@/lib/theme";

/** "Show to driver": the place's local-script name and address, big, on a dark card. */
export default function DriverScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { place: id } = useLocalSearchParams<{ place?: string }>();
  const { bundle } = useData();
  const [big, setBig] = useState(false);
  const place = bundle?.places.find((p) => p.id === id);
  if (!bundle || !place) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="Place not found" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  const card = driverCard(place, bundle.trip);
  const lang = languageByCode(card.lang)!;
  const isStay = bundle.stays.some((x) => x.place_id === place.id);
  const spoken = [card.headline, card.name, card.address].filter(Boolean).join("。 ");
  const scale = big ? 1.4 : 1;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{isStay ? "Your stay" : bundle.trip.name}</Text>
            <Text accessibilityRole="header" style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>Show to driver</Text>
          </View>
        </View>

        <View accessible accessibilityLabel={`Card for the driver: ${card.headline}. ${card.name}. ${card.address ?? ""}${card.phone ? `. ${card.phone}` : ""}`} accessibilityLanguage={lang.speech} style={{ backgroundColor: "#121614", borderRadius: 22, padding: big ? 28 : 22, gap: 12, minHeight: big ? 520 : undefined, justifyContent: big ? "center" : undefined }}>
          <Text style={{ color: "#C9D3CC", fontSize: 22 * scale, lineHeight: 30 * scale, fontFamily: t.font.bold }}>{card.headline}</Text>
          {card.romanized ? <Text style={{ color: "#98A39C", fontSize: 14, fontFamily: t.font.regular }}>{card.romanized}</Text> : null}
          <Text style={{ color: "#F1F3EF", fontSize: 34 * scale, lineHeight: 42 * scale, fontFamily: t.font.extrabold, letterSpacing: -0.4 }}>{card.name}</Text>
          {card.address ? <Text style={{ color: "#F1F3EF", fontSize: 24 * scale, lineHeight: 32 * scale, fontFamily: t.font.semibold }}>{card.address}</Text> : null}
          {card.phone ? <Text accessibilityRole="link" onPress={() => Linking.openURL(`tel:${card.phone}`)} style={{ color: "#F1F3EF", fontSize: 22 * scale, fontFamily: t.font.bold, textDecorationLine: "underline" }}>{card.phone}</Text> : null}
          {card.hasLocal ? (
            <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 12 }}>
              <Text style={{ color: "#F1F3EF", fontSize: 14, fontFamily: t.font.bold }}>{card.english.name}</Text>
              {card.english.address ? <Text style={{ color: "#C9D3CC", fontSize: 14, fontFamily: t.font.regular }}>{card.english.address}</Text> : null}
            </View>
          ) : <Text style={{ color: "#C9D3CC", fontSize: 13, fontFamily: t.font.regular }}>This place has no {lang.name} name or address saved yet, so the English one is shown.</Text>}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <SpeakButton text={spoken} lang={lang.speech} variant="ink" />
          <Button variant="secondary" size="sm" label={big ? "Smaller" : "Enlarge"} accessibilityState={{ selected: big }} icon={<Ionicons name={big ? "contract-outline" : "expand-outline"} size={16} color={t.text} />} onPress={() => setBig((b) => !b)} />
          <Button variant="secondary" size="sm" label="Show map" icon={<Ionicons name="map-outline" size={16} color={t.text} />} onPress={() => router.push({ pathname: "/navigate/route", params: { to: place.id, mode: "drive" } })} />
        </View>
        <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>Hold the card up, or tap Speak. The address comes from the place you saved; edit the place to change it.</Text>
      </ScrollView>
    </View>
  );
}
