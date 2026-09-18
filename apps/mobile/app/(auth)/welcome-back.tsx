import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthHero } from "@/components/AuthHero";
import { Button, Tile } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** "Welcome back, Joe" — Face ID on iPhone, fingerprint/face on Android; no email code. */
export default function WelcomeBack() {
  const t = useTheme();
  const router = useRouter();
  const { remembered, biometrics, unlockWithBiometrics, forgetRemembered } = useSession();
  const [failed, setFailed] = useState(false);

  useEffect(() => { if (!remembered) router.replace("/(auth)/welcome"); }, [remembered, router]);
  if (!remembered) return null;

  const method = biometrics === "face" ? (Platform.OS === "ios" ? "Face ID" : "face unlock") : biometrics === "fingerprint" ? "fingerprint" : null;
  const unlock = async () => {
    const ok = await unlockWithBiometrics();
    if (!ok) setFailed(true);
  };

  return (
    <AuthHero>
      <View style={{ alignItems: "center", gap: 22, paddingBottom: 40 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }} accessible={false}>
          <Ionicons name={biometrics === "fingerprint" ? "finger-print-outline" : "scan-outline"} size={60} color="#fff" />
        </View>
        <View style={{ alignItems: "center" }}>
          <Text accessibilityRole="header" style={{ fontSize: 30, fontFamily: t.font.extrabold, color: "#F1F3EF", letterSpacing: -0.5, textAlign: "center" }}>Welcome back, {remembered.name}</Text>
          <Text style={{ fontSize: 15, color: "#98A39C", marginTop: 8, fontFamily: t.font.regular }}>{method ? `${method[0]!.toUpperCase()}${method.slice(1)} · ` : ""}{remembered.email}</Text>
        </View>
        <Tile name={remembered.name} size={0} />
      </View>
      {failed && <Text accessibilityRole="alert" style={{ color: "#F58FB4", fontSize: 13, fontFamily: t.font.semibold, textAlign: "center" }}>Couldn&apos;t verify. Use your password instead.</Text>}
      <View style={{ gap: 8 }}>
        {method && <Button size="cta" full label={`Unlock with ${method}`} style={{ backgroundColor: "#7DBA8E" }} onPress={unlock} />}
        <Button variant="translucent" size="cta" full label="Use password" onPress={() => router.push({ pathname: "/(auth)/login", params: { email: remembered.email } })} />
      </View>
      <Text style={{ fontSize: 12, color: "#98A39C", textAlign: "center", fontFamily: t.font.regular }}>
        Not {remembered.name}?{" "}
        <Text accessibilityRole="button" onPress={() => { void forgetRemembered(); router.replace("/(auth)/login"); }} style={{ color: "#7DBA8E", fontFamily: t.font.bold }}>Switch account</Text>
      </Text>
    </AuthHero>
  );
}
