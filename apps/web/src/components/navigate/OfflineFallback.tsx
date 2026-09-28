"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useOnline } from "@/lib/local-store";

/**
 * Directions while offline or slow (mockup 6b): the cached estimate stays, live transit is
 * marked unavailable, and the driver card is offered because it needs no connection.
 */
export function OfflineFallback({ placeId, placeName, localLanguage }: { placeId: string; placeName: string; localLanguage: string | null }) {
  const online = useOnline();
  const router = useRouter();
  if (online) return null;
  const lang = localLanguage === "ja" ? "日本語" : localLanguage === "ko" ? "한국어" : "the local language";
  return (
    <div className="flex flex-col gap-2.5" role="status">
      <p className="flex items-center gap-2 rounded-lg bg-button-ink px-3.5 py-2.5 text-[12.5px] font-bold text-on-button-ink"><WifiOff aria-hidden="true" size={14} />Slow connection · live transit unavailable</p>
      <div className="card flex flex-col gap-2 p-4">
        <p className="text-[13.5px] text-muted">Showing the estimate from the cached map · no live traffic.</p>
        <p className="text-[14px] font-semibold">Show {placeName}&apos;s address to a taxi driver instead. It works without a connection.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/translate/driver?place=${placeId}`} className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-[14px] font-bold text-on-primary">Show address in {lang} →</Link>
          <Button variant="secondary" onClick={() => router.refresh()}>Retry</Button>
        </div>
      </div>
    </div>
  );
}
