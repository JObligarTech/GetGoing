import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/AuthForms";
import { FadeIn } from "@/components/ui/Motion";
import { getLastUser } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; fresh?: string }> }) {
  const { next, error, fresh } = await searchParams;
  // Returning users land on the "Welcome back" screen instead.
  const last = await getLastUser();
  if (last && !fresh) redirect(next ? `/welcome-back?next=${encodeURIComponent(next)}` : "/welcome-back");
  return (
    <FadeIn className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] lg:text-[34px]">Log in</h1>
        <p className="mt-2 text-[15px] text-[#98A39C]">Pick up your trip where you left it.</p>
      </div>
      {error === "oauth" && <p role="alert" className="text-[13px] font-semibold text-[#F58FB4]">That sign-in didn&apos;t complete. Try again or use email.</p>}
      {error === "link" && <p role="alert" className="text-[13px] font-semibold text-[#F58FB4]">That link has expired. Log in to get a new one.</p>}
      <LoginForm next={next} />
    </FadeIn>
  );
}
