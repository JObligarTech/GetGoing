import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getActiveTrip } from "@/lib/data";
import { getSessionUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/welcome");
  const trip = await getActiveTrip(user.profile.home_tz);
  return <AppShell user={{ name: user.profile.display_name, tripName: trip?.name ?? null }}>{children}</AppShell>;
}
