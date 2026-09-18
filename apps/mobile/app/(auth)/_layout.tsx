import { Redirect, Stack } from "expo-router";
import { useSession } from "@/lib/session";

export default function AuthLayout() {
  const { user } = useSession();
  if (user) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#121614" }, animation: "fade" }} />;
}
