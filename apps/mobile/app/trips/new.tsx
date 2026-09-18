import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, PageHeader, screenStyles } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** Trip creation lands with the Trips round on mobile; the web form is the reference implementation. */
export default function NewTrip() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={s.screen}>
      <View style={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow="Trips" title="New trip" />
        <EmptyState title="Create trips on the web for now" body="Trip creation on mobile arrives with the next round. Trips you create at voya.app sync here." action={<Button variant="secondary" label="Back" onPress={() => router.back()} />} />
      </View>
    </View>
  );
}
