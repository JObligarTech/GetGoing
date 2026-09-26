import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { suggestLanguages } from "@voya/core";
import { Card, Chip, IconCoin, ListRow, PageHeader, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

export default function Tools() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { active } = useData();
  const { user } = useSession();
  const pair = suggestLanguages(active, user?.profile ?? null);
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow={active?.name} title="Tools" />
        <Card>
          <ListRow onPress={() => router.push("/translate")} leading={<IconCoin name="language-outline" />} title="Translate" subtitle={`${pair.to.native} ready · text, voice, camera`} chevron />
          <ListRow onPress={() => router.push("/currency")} leading={<IconCoin name="cash-outline" />} title="Currency" subtitle={active?.local_currency ? `${user?.profile.home_currency ?? "USD"} ⇄ ${active.local_currency}` : "Set a trip currency"} trailing={<Chip tone="premium">Premium</Chip>} chevron />
          <ListRow onPress={() => router.push("/(tabs)/navigate")} leading={<IconCoin name="receipt-outline" />} title="Split" subtitle="Scan a receipt, assign items · next round" trailing={<Chip tone="premium">Premium</Chip>} chevron last />
        </Card>
      </ScrollView>
    </View>
  );
}
