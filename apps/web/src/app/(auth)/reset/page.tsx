import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/AuthForms";
import { FadeIn } from "@/components/ui/Motion";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <FadeIn className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] lg:text-[34px]">Reset password</h1>
        <p className="mt-2 text-[15px] text-[#98A39C]">We&apos;ll email you a link to choose a new one.</p>
      </div>
      <ResetForm />
    </FadeIn>
  );
}
