import type { Metadata } from "next";
import { formatEnds } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Avatar, PassStar } from "@/components/ui/PassMark";
import { Card } from "@/components/ui/primitives";
import { acceptGiftAction, giftPreviewAction } from "@/app/gift/actions";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "A gift of Atlas Premium Pass", robots: { index: false, follow: false } };

/** Recipient's view (mockup 8c): who sent it, for which trip, when it ends; accept after signing in. */
export default async function GiftLandingPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string }> }) {
  const { code } = await params;
  const { error } = await searchParams;
  const [preview, user] = await Promise.all([giftPreviewAction(code), getSessionUser()]);
  if (!preview || preview.status !== "sent" || preview.expired) {
    return (
      <section aria-labelledby="gift-title" className="card flex flex-col gap-2 p-5">
        <h1 id="gift-title" className="text-[22px] font-extrabold">{preview?.status === "accepted" ? "This gift was already accepted" : "This gift isn't active"}</h1>
        <p className="text-[14px] text-muted">Gift links last 30 days and work once. Ask the person who sent it for a new one, or get your own pass.</p>
        <Button href="/pass" variant="secondary">Atlas Premium Pass</Button>
      </section>
    );
  }
  const next = `/gift/${code}`;
  const tz = preview.trip_tz ?? "UTC";
  return (
    <section aria-labelledby="gift-title" className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar name={preview.giver_name} size={64} mark="pass" label={`${preview.giver_name}, Atlas Premium Pass`} />
        <p className="text-[13px] font-semibold text-muted">A gift from {preview.giver_name}</p>
        <h1 id="gift-title" className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{preview.days} days of Atlas Premium Pass</h1>
        <p className="text-[14px] text-muted">For {preview.trip_name}. Split, Navigate trees, Translate and Currency unlock the moment you accept.</p>
      </div>
      <Card className="divide-y divide-line text-[14px]">
        <div className="flex justify-between px-4 py-3"><span className="text-muted">Access</span><span className="flex items-center gap-1.5 font-semibold"><PassStar size={12} className="text-premium" />Full Atlas Premium Pass · {preview.days} days</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-muted">Ends</span><span className="font-semibold">{formatEnds(new Date(preview.ends_preview), tz)} if accepted today</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-muted">Need longer?</span><span className="font-semibold">Extend up to 7 days · $0.99</span></div>
      </Card>
      <p className="text-center text-[12.5px] text-muted">No card needed to accept. Nothing renews.</p>
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error === "rate" ? "Too many attempts. Try again in a minute." : error}</p>}
      {user ? (
        <form action={acceptGiftAction} className="flex flex-col gap-2">
          <input type="hidden" name="code" value={code} />
          <Button type="submit" size="cta" full>Accept gift as {user.profile.display_name.split(" ")[0]}</Button>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <Button href={`/signup?next=${encodeURIComponent(next)}`} size="cta" full>Create account to accept</Button>
          <Button href={`/login?next=${encodeURIComponent(next)}`} variant="secondary" size="cta" full>Log in</Button>
        </div>
      )}
    </section>
  );
}
