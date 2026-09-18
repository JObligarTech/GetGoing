import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
export const metadata: Metadata = { title: "Translate" };
export default function TranslatePage() {
  return <ComingSoon title="Translate" blurb="Text, conversation and camera translation, suggesting 日本語 from the trip. Phone-first; the translation provider interface is ready in @voya/core." />;
}
