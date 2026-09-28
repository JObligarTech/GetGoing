"use client";
import { Check, WifiOff } from "lucide-react";
import { Card, Chip, SectionHeader } from "@/components/ui/primitives";
import { useNow, useOnline } from "@/lib/local-store";
import { agoLabel, offlineStore, packsStore } from "@/lib/offline";

/** Home, offline (mockup 6b): what's cached, what's from a while ago, and what needs internet. */
export function OfflineCard({ tripId }: { tripId: string }) {
  const online = useOnline();
  const cached = offlineStore.use();
  const packs = packsStore.use();
  const now = useNow();
  if (online) return null;
  const c = cached?.tripId === tripId ? cached : null;
  const rows: { title: string; state: string; ok: boolean }[] = [
    { title: `${c?.places ?? 0} saved places`, state: "Cached", ok: true },
    { title: `${c?.city ?? "City"} map · ${c?.routes ?? 0} saved routes`, state: Object.keys(packs).some((k) => k.startsWith(`map:${tripId}:`)) || c ? "Cached" : "Not downloaded", ok: true },
    ...(c?.fx ? [{ title: `${c.fx.pair} rate`, state: `From ${agoLabel(c.fx.asOf, now)}`, ok: true }] : []),
    { title: `Text translation · ${c?.phrases ?? 0} phrases`, state: c?.langPack ? "Pack installed" : "Phrasebook", ok: true },
    { title: "Receipt scan · live transit · voice", state: "Needs internet", ok: false },
  ];
  return (
    <section aria-labelledby="offline-title" className="flex flex-col gap-2">
      <SectionHeader title="Available offline" id="offline-title" />
      <Card className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.title} className="flex items-center gap-3 px-3.5 py-3">
            <span aria-hidden="true" className={r.ok ? "inline-flex h-8 w-8 items-center justify-center rounded-md bg-tint text-primary" : "inline-flex h-8 w-8 items-center justify-center rounded-md bg-canvas text-muted"}>{r.ok ? <Check size={16} /> : <WifiOff size={16} />}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.title}</span>
            <Chip tone={r.ok ? "tint" : "plain"}>{r.state}</Chip>
          </div>
        ))}
      </Card>
    </section>
  );
}
