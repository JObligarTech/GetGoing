import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/AuthForms";
import { FadeIn } from "@/components/ui/Motion";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <FadeIn className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] lg:text-[34px]">Create account</h1>
        <p className="mt-2 text-[15px] text-[#98A39C]">One account for every trip, on every device.</p>
      </div>
      <SignupForm next={next} />
    </FadeIn>
  );
}
