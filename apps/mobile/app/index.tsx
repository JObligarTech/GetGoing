import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";

/** Entry: signed in → tabs; remembered user → Welcome back; otherwise Welcome. */
export default function Index() {
  const { user, remembered } = useSession();
  if (user) return <Redirect href="/(tabs)" />;
  return <Redirect href={remembered ? "/(auth)/welcome-back" : "/(auth)/welcome"} />;
}
