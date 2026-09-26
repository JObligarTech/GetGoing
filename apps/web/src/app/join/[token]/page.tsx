import type { Metadata } from "next";
import { formatDateRange } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Tile } from "@/components/ui/primitives";
import { acceptInviteAction, invitePreviewAction } from "@/app/join/actions";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Join a trip", robots: { index: false, follow: false } };

/** Invite link: what the trip is and who asked; sign in (or create an account) to join, then the database adds you. */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const [preview, user] = await Promise.all([invitePreviewAction(token), getSessionUser()]);
  if (!preview || preview.accepted) {
    return (
      <section aria-labelledby="join-title" className="card flex flex-col gap-2 p-5">
        <h1 id="join-title" className="text-[22px] font-extrabold">{preview?.accepted ? "This invite was already used" : "This invite isn't active"}</h1>
        <p className="text-[14px] text-muted">Invites last 30 days and work once. Ask the person who sent it for a fresh link.</p>
      </section>
    );
  }
  const next = `/join/${token}`;
  return (
    <section aria-labelledby="join-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-3"><Tile name={preview.trip_name} size={56} radius={14} /><div><p className="text-[13px] font-semibold text-muted">{preview.inviter} invited you{preview.traveler ? ` as ${preview.traveler}` : ""}</p><h1 id="join-title" className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{preview.trip_name}</h1></div></div>
      <p className="text-[14px] text-muted">Join to see the plan, routes and bills, and to pick your own items in Split. This link works until {formatDateRange(preview.expires_at.slice(0, 10), null)}.</p>
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">Couldn&apos;t join with this link. It may have been used or expired.</p>}
      {user ? (
        <form action={acceptInviteAction} className="flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" size="cta" full>Join as {user.profile.display_name.split(" ")[0]}</Button>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <Button href={`/signup?next=${encodeURIComponent(next)}`} size="cta" full>Create account to join</Button>
          <Button href={`/login?next=${encodeURIComponent(next)}`} variant="secondary" size="cta" full>Log in</Button>
        </div>
      )}
    </section>
  );
}
