import type { Metadata } from "next";
import Link from "next/link";
import { ProviderButtons } from "@/components/auth/ProviderButtons";
import { FadeIn } from "@/components/ui/Motion";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string; deleted?: string }> }) {
  const { next, deleted } = await searchParams;
  return (
    <FadeIn className="flex flex-col gap-5">
      {deleted === "1" && <p role="status" className="rounded-lg bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold">Your account and data have been deleted.</p>}
      <div>
        <h1 className="text-[48px] leading-none font-extrabold tracking-[-0.03em] lg:text-[64px]">Voya</h1>
        <p className="mt-2 text-[18px] text-[#C9D3CC] lg:text-[20px]">Your whole trip. One place.</p>
      </div>
      <ProviderButtons next={next} />
      <p className="text-center text-[12px] text-[#98A39C]">
        Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-bold text-[#7DBA8E]">Log in</Link>
      </p>
    </FadeIn>
  );
}
