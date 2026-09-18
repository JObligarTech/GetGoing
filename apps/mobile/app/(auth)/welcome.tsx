import { Platform, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthHero } from "@/components/AuthHero";
import { Button } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** Welcome — iPhone: Apple / Google / email; Android: Google / phone / email with pill buttons. */
export default function Welcome() {
  const t = useTheme();
  const router = useRouter();
  const android = Platform.OS === "android";
  return (
    <AuthHero>
      <View>
        <Text accessibilityRole="header" style={{ fontSize: 48, fontFamily: t.font.extrabold, color: "#F1F3EF", letterSpacing: -1.5, lineHeight: 52 }}>Voya</Text>
        <Text style={{ fontSize: 18, color: "#C9D3CC", marginTop: 8, fontFamily: t.font.regular }}>Your whole trip. One place.</Text>
      </View>
      <View style={{ gap: 8 }}>
        {android ? (
          <>
            <Button variant="light" size="cta" full label="Continue with Google" icon={<Ionicons name="logo-google" size={16} color="#121614" />} onPress={() => router.push("/(auth)/login")} />
            <Button variant="translucent" size="cta" full label="Continue with phone number" onPress={() => router.push("/(auth)/login")} />
          </>
        ) : (
          <>
            <Button variant="light" size="cta" full label="Continue with Apple" icon={<Ionicons name="logo-apple" size={16} color="#121614" />} onPress={() => router.push("/(auth)/login")} />
            <Button variant="translucent" size="cta" full label="Continue with Google" icon={<Ionicons name="logo-google" size={16} color="#F1F3EF" />} onPress={() => router.push("/(auth)/login")} />
          </>
        )}
        <Button size="cta" full label="Continue with email" style={{ backgroundColor: "#7DBA8E" }} onPress={() => router.push("/(auth)/login")} />
      </View>
      <Text style={{ fontSize: 12, color: "#98A39C", textAlign: "center", fontFamily: t.font.regular }}>
        Already have an account? <Link href="/(auth)/login" style={{ color: "#7DBA8E", fontFamily: t.font.bold }} accessibilityRole="link">Log in</Link>
      </Text>
    </AuthHero>
  );
}
