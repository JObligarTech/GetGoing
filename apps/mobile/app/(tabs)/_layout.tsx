import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const ICONS = {
  index: ["home", "home-outline"],
  trips: ["location", "location-outline"],
  navigate: ["compass", "compass-outline"],
  tools: ["grid", "grid-outline"],
  profile: ["person", "person-outline"],
} as const;

/** Home | Trip | Navigate | Tools | Profile — iOS tab bar; Android gets the Material-style taller bar with labels. */
export default function TabsLayout() {
  const t = useTheme();
  const { user } = useSession();
  if (!user) return <Redirect href="/(auth)/welcome" />;
  const android = Platform.OS === "android";
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: t.canvas },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, height: android ? 80 : 84, paddingTop: android ? 12 : 8 },
        tabBarLabelStyle: { fontFamily: t.font.semibold, fontSize: android ? 12 : 10.5 },
        tabBarIcon: ({ focused, color, size }) => {
          const [on, off] = ICONS[route.name as keyof typeof ICONS] ?? ICONS.index;
          return <Ionicons name={focused ? on : off} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarAccessibilityLabel: "Home" }} />
      <Tabs.Screen name="trips" options={{ title: "Trip", tabBarAccessibilityLabel: "Trip" }} />
      <Tabs.Screen name="navigate" options={{ title: "Navigate", tabBarAccessibilityLabel: "Navigate" }} />
      <Tabs.Screen name="tools" options={{ title: "Tools", tabBarAccessibilityLabel: "Tools" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarAccessibilityLabel: "Profile" }} />
    </Tabs>
  );
}
