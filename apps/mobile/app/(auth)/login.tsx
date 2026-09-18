import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { AuthHero } from "@/components/AuthHero";
import { Button, announce } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

export default function Login() {
  const t = useTheme();
  const { email: presetEmail } = useLocalSearchParams<{ email?: string }>();
  const { signIn } = useSession();
  const [email, setEmail] = useState(presetEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const err = await signIn(email, password);
    setBusy(false);
    setError(err);
    if (err) announce(err);
  };

  const field = { height: 48, borderRadius: 12, borderWidth: 1, borderColor: error ? "#F58FB4" : "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.10)", color: "#F1F3EF", paddingHorizontal: 14, fontSize: 15, fontFamily: t.font.regular };
  const labelStyle = { fontSize: 13, color: "#C9D3CC", fontFamily: t.font.semibold, marginBottom: 6 };
  return (
    <AuthHero>
      <View>
        <Text accessibilityRole="header" style={{ fontSize: 30, fontFamily: t.font.extrabold, color: "#F1F3EF", letterSpacing: -0.5 }}>Log in</Text>
        <Text style={{ fontSize: 15, color: "#98A39C", marginTop: 8, fontFamily: t.font.regular }}>Pick up your trip where you left it.</Text>
      </View>
      {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: "#F58FB4", fontSize: 13, fontFamily: t.font.semibold }}>{error}</Text>}
      <View style={{ gap: 14 }}>
        <View>
          <Text nativeID="email-label" style={labelStyle}>Email</Text>
          <TextInput accessibilityLabelledBy="email-label" accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} style={field} placeholderTextColor="#98A39C" />
        </View>
        <View>
          <Text nativeID="password-label" style={labelStyle}>Password</Text>
          <TextInput accessibilityLabelledBy="password-label" accessibilityLabel="Password" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} returnKeyType="go" style={field} />
        </View>
        <Button size="cta" full label={busy ? "Logging in…" : "Log in"} disabled={busy} style={{ backgroundColor: "#7DBA8E" }} onPress={submit} accessibilityState={{ busy, disabled: busy }} />
      </View>
      <Text style={{ fontSize: 12, color: "#98A39C", textAlign: "center", fontFamily: t.font.regular }}>
        <Link href="/(auth)/welcome" style={{ color: "#7DBA8E", fontFamily: t.font.bold }} accessibilityRole="link">Back</Link>
        {"  ·  "}
        <Text style={{ color: "#7DBA8E", fontFamily: t.font.bold }}>Forgot password?</Text>
      </Text>
    </AuthHero>
  );
}
