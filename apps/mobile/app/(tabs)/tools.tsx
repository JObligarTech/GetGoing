import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Chip, IconCoin, ListRow, PageHeader, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useTheme } from "@/lib/theme";

export default function Tools() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { active } = useData();
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow={active?.name} title="Tools" />
        <Card>
          <ListRow onPress={() => router.push("/(tabs)/navigate")} leading={<IconCoin name="language-outline" />} title="Translate" subtitle={`${active?.local_language === "ja" ? "日本語" : "Language"} ready · text, voice, camera`} chevron />
          <ListRow onPress={() => router.push("/(tabs)/navigate")} leading={<IconCoin name="cash-outline" />} title="Currency" subtitle={active?.local_currency ? `USD ⇄ ${active.local_currency}` : "Set a trip currency"} trailing={<Chip tone="premium">Premium</Chip>} chevron />
          <ListRow onPress={() => router.push("/(tabs)/navigate")} leading={<IconCoin name="receipt-outline" />} title="Split" subtitle="Scan a receipt, assign items" trailing={<Chip tone="premium">Premium</Chip>} chevron last />
        </Card>
      </ScrollView>
    </View>
  );
}
