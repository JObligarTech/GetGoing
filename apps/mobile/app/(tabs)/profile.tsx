import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Chip, Eyebrow, ListRow, PageHeader, Tile, screenStyles } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

export default function Profile() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const { user, biometrics, signOut } = useSession();
  if (!user) return null;
  const p = user.profile;
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow="Trip defaults reused by every tool" title="Profile" />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }} accessible accessibilityLabel={`${p.display_name}, ${user.email ?? ""}, Free plan`}>
            <Tile name={p.display_name} radius={26} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: t.font.bold, color: t.text }}>{p.display_name}</Text>
              <Text style={{ fontSize: 12.5, color: t.textMuted, fontFamily: t.font.regular }}>{user.email}</Text>
            </View>
            <Chip tone="plain">Free</Chip>
          </View>
        </Card>
        <Eyebrow>Defaults</Eyebrow>
        <Card>
          <ListRow title="Home currency" trailing={<Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.textMuted }}>{p.home_currency}</Text>} accessibilityLabel={`Home currency ${p.home_currency}`} />
          <ListRow title="Home time zone" trailing={<Text style={{ fontSize: 13, fontFamily: t.font.bold, color: t.textMuted }}>{p.home_tz}</Text>} accessibilityLabel={`Home time zone ${p.home_tz}`} />
          <ListRow title="Sign-in" subtitle={biometrics === "none" ? "Password" : biometrics === "face" ? "Face ID enabled" : "Fingerprint enabled"} last />
        </Card>
        <Eyebrow>Privacy & legal</Eyebrow>
        <Card>
          <ListRow title="Terms of Service" chevron />
          <ListRow title="Privacy Policy" chevron />
          <ListRow title="Download or delete my data" subtitle="Export is a JSON file; deletion is immediate and permanent." chevron last />
        </Card>
        <Button variant="secondary" label="Sign out" full onPress={() => void signOut()} />
      </ScrollView>
    </View>
  );
}
