import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
export const metadata: Metadata = { title: "Navigate" };
export default function NavigatePage() {
  return <ComingSoon title="Navigate" premium blurb="Routes from your saved places, multi-stop days, navigation trees and 'Take me back to my hotel'. The trip context is already wired for it." />;
}
