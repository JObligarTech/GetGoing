import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TripMap } from "./MapView";

/** Dark world map with the trip pin on Tokyo, vignette, and bottom-anchored content — every auth screen. */
export function AuthHero({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#121614" }}>
      <TripMap center={{ lat: 30, lng: 110 }} zoom={1.6} dark label="" pins={[{ id: "tokyo", lat: 35.68, lng: 139.7, color: "#7DBA8E" }]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(18,22,20,0.55)" }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: "45%", backgroundColor: "rgba(18,22,20,0.9)" }]} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) + 20, gap: 20 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
