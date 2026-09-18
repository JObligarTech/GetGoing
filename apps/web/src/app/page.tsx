import { redirect } from "next/navigation";

// proxy.ts already routes "/" — this is a fallback for direct renders.
export default function Index() {
  redirect("/welcome");
}
