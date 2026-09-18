import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
export const metadata: Metadata = { title: "Split" };
export default function SplitPage() {
  return <ComingSoon title="Split" premium blurb="Scan → correct → assign → share. Travelers are already on the trip, so nobody has to be re-added." />;
}
