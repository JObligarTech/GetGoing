import type { Metadata } from "next";
import { Tile } from "@/components/ui/primitives";
import { ClaimForm } from "@/components/split/ClaimForm";
import { claimViewAction, submitClaimAction } from "@/app/s/actions";
import { fx } from "@/lib/providers";

export const metadata: Metadata = { title: "Pick what you ordered", robots: { index: false, follow: false } };

/** The claim link (mockup 5b): "Joe sent you a bill from Afuri. Chris, pick what you ordered." No account. */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await claimViewAction(token);
  if (!view) {
    return (
      <section aria-labelledby="claim-title" className="card flex flex-col gap-2 p-5">
        <h1 id="claim-title" className="text-[22px] font-extrabold">This link isn&apos;t active</h1>
        <p className="text-[14px] text-muted">It may have expired (links last 30 days), or the person who sent it hasn&apos;t shared it yet. Ask them for a fresh one.</p>
      </section>
    );
  }
  // A rough home-currency hint for the guest: the trip's traveler gets it from their own profile when they join.
  let homeRate: { currency: string; rate: number } | null = null;
  if (view.currency !== "USD") { try { homeRate = { currency: "USD", rate: (await fx.rate(view.currency, "USD")).rate }; } catch { homeRate = null; } }
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="claim-title" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Tile name={view.sender} size={44} radius={999} />
          <p className="text-[13px] font-semibold text-muted">{view.sender} sent you a bill from <span className="text-ink">{view.merchant}</span></p>
        </div>
        <h1 id="claim-title" className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{view.you.name}, pick what you ordered</h1>
        <p className="text-[13px] text-muted">No account needed · tap everything you had</p>
      </section>
      <ClaimForm token={token} view={view} homeRate={homeRate} submitAction={submitClaimAction} />
    </div>
  );
}
