import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, EmptyState, PageHeader, screenStyles } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** Placeholder for the Navigate round; the route is real so the tab bar and deep links work today. */
export default function Navigate() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  return (
    <View style={s.screen}>
      <View style={[s.content, { paddingTop: insets.top + 8 }]}>
        <PageHeader eyebrow="Next round" title="Navigate" action={<Chip tone="premium">Atlas Premium Pass</Chip>} />
        <EmptyState title="Navigate is coming in the next build round" body="Routes from your saved places, multi-stop days and 'Take me back to my hotel'. The trip context is already wired for it." />
      </View>
    </View>
  );
}
