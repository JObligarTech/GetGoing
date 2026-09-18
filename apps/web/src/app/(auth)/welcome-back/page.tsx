import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { LoginForm } from "@/components/auth/AuthForms";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Motion";
import { Tile } from "@/components/ui/primitives";
import { forgetLastUser, getLastUser } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Welcome back" };

/**
 * "Welcome back, Joe" — the passkey/Face ID return screen. On the web we can't
 * do device biometrics, so the primary path is the remembered email + password;
 * the session itself is already restored by Supabase if it's still valid.
 */
export default async function WelcomeBackPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const last = await getLastUser();
  if (!last) redirect("/login?fresh=1");
  return (
    <FadeIn className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <div className="relative">
          <Tile name={last.name} size={88} radius={999} className="border-2 border-[#1B211D] text-[37px]" />
          <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#121614] bg-[#7DBA8E] text-[#0F1A13]"><Fingerprint size={16} /></span>
        </div>
        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] lg:text-[34px]">Welcome back, {last.name}</h1>
          <p className="mt-2 text-[15px] text-[#98A39C]">{last.email}</p>
        </div>
      </div>
      <LoginForm next={next} presetEmail={last.email} />
      <form action={forgetLastUser} className="text-center text-[12px] text-[#98A39C]">
        Not {last.name}? <Button type="submit" variant="ghost" size="sm" className="h-auto min-h-0 p-0 text-[12px] text-[#7DBA8E] hover:bg-transparent">Switch account</Button>
      </form>
    </FadeIn>
  );
}
