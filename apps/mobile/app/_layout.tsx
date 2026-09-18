import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DataProvider } from "@/lib/data";
import { SessionProvider, useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const t = useTheme();
  const { ready } = useSession();
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  useEffect(() => { if (ready && fontsLoaded) SplashScreen.hideAsync().catch(() => {}); }, [ready, fontsLoaded]);
  if (!ready || !fontsLoaded) return null;
  return (
    <>
      <StatusBar style={t.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.canvas }, animation: "fade_from_bottom", animationDuration: 220 }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="place/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="plan" />
        <Stack.Screen name="navigate" />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <DataProvider>
            <Root />
          </DataProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
