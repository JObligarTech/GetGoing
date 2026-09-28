"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Link2 } from "lucide-react";
import type { GiftCandidate } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/PassMark";
import { Card } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";

/** Share the gift link: the OS sheet on phones, the clipboard elsewhere; the link itself is always shown too. */
async function shareGift(url: string, name: string, tripName: string): Promise<string> {
  const text = `${name}, you've been gifted 3 days of Atlas Premium Pass on ${tripName}. Accept it here: ${url}`;
  try {
    if (navigator.share) { await navigator.share({ text }); return `Gift link shared with ${name}.`; }
    await navigator.clipboard.writeText(url); return `Gift link for ${name} copied. Paste it wherever you chat.`;
  } catch { return `Gift link ready to share.`; }
}

/** The sent state (server-rendered from the gift row, so it survives refreshes): share again, or head back. */
export function GiftSent({ url, name, tripName, status: initialStatus }: { url: string; name: string; tripName: string; status: string }) {
  const [status, setStatus] = useState("");
  return (
    <Card className="flex flex-col gap-3 p-5 text-center">
      <span aria-hidden="true" className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-premium-bg text-premium-text"><Gift size={22} /></span>
      <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Gift sent to {name}</h2>
      <p className="text-[13px] text-muted">{initialStatus} It starts when {name} accepts and ends 3 days later at midnight, trip time. The link works for 30 days.</p>
      <p className="break-all text-[12px] text-muted">{url}</p>
      <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>
      <Button variant="secondary" icon={<Link2 size={16} />} onClick={async () => setStatus(await shareGift(url, name, tripName))}>Share the link again</Button>
      <Button href="/split" variant="ghost">Back to Split</Button>
    </Card>
  );
}

/**
 * Gift picker (mockup 8c): one traveler on this trip gets 3 days. The gift is a link; sharing
 * uses the OS sheet on phones and the clipboard elsewhere.
 */
export function GiftPicker({ tripId, tripName, candidates, endsPreview, action }: {
  tripId: string; tripName: string; candidates: GiftCandidate[]; endsPreview: string;
  action: (tripId: unknown, travelerId: unknown) => Promise<{ url: string; code: string } | { error: string }>;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(candidates.find((c) => c.eligible)?.traveler.id ?? null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pick = candidates.find((c) => c.traveler.id === chosen) ?? null;
  const first = pick?.traveler.name.split(" ")[0];

  const send = () => {
    if (!pick || !first) return;
    start(async () => {
      const r = await action(tripId, pick.traveler.id);
      if ("error" in r) { setError(r.error); return; }
      setError(null);
      setStatus(await shareGift(r.url, first, tripName));
      router.refresh(); // the page now shows the sent gift (GiftSent) from the gift row itself
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="divide-y divide-line" role="radiogroup" aria-label="Who gets it">
        {candidates.map((c) => {
          const on = c.traveler.id === chosen;
          return (
            <button key={c.traveler.id} type="button" role="radio" aria-checked={on} disabled={!c.eligible} onClick={() => setChosen(c.traveler.id)} className={cx("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-(--dur-fast)", on ? "bg-tint" : "hover:bg-tint/60", !c.eligible && "opacity-60")}>
              <Avatar name={c.traveler.name} color={c.traveler.color} size={40} mark={c.eligible ? null : "pass"} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{c.traveler.name}</span><span className="block truncate text-[12px] text-muted">{c.status}</span></span>
              <span aria-hidden="true" className={cx("inline-flex h-6 w-6 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-on-primary" : "border-line-strong")}>{on && <Check size={14} strokeWidth={3} />}</span>
            </button>
          );
        })}
      </Card>
      {pick && (
        <Card className="divide-y divide-line text-[14px]">
          <div className="flex justify-between px-4 py-3"><span className="text-muted">Starts</span><span className="font-semibold">When {first} accepts</span></div>
          <div className="flex justify-between px-4 py-3"><span className="text-muted">Ends</span><span className="font-semibold">3 days later · {endsPreview}</span></div>
          <div className="flex justify-between gap-3 px-4 py-3"><span className="text-muted">After that</span><span className="text-right font-semibold">{first} can extend · $0.99 for up to 7 days</span></div>
        </Card>
      )}
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</p>}
      <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>
      <Button size="cta" full disabled={!pick} loading={pending} icon={<Gift size={16} />} onClick={send}>Send gift{first ? ` to ${first}` : ""}</Button>
    </div>
  );
}
