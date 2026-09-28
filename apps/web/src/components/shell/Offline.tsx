"use client";
import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useNow, useOnline } from "@/lib/local-store";
import { agoLabel, offlineStore, type OfflineSummary } from "@/lib/offline";

/** Keeps the device's offline summary fresh while online; renders nothing. */
export function OfflineSync({ summary }: { summary: Omit<OfflineSummary, "savedAt"> | null }) {
  const online = useOnline();
  const key = JSON.stringify(summary);
  useEffect(() => {
    if (!summary || !online) return;
    offlineStore.set({ ...summary, savedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online]);
  return null;
}

/** "You're offline · showing Japan 2027 saved 41 min ago" — above every page while the connection is gone. */
export function OfflineBanner() {
  const online = useOnline();
  const cached = offlineStore.use();
  const now = useNow();
  if (online) return null;
  return (
    <p role="status" className="flex items-center gap-2 bg-button-ink px-4 py-2 text-[12.5px] font-bold text-on-button-ink md:px-7">
      <WifiOff aria-hidden="true" size={14} />
      You&apos;re offline{cached ? ` · showing ${cached.tripName} saved ${agoLabel(cached.savedAt, now)}` : " · showing what this device has"}
    </p>
  );
}
