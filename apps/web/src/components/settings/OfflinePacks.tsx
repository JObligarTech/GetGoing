"use client";
import { Check, Download } from "lucide-react";
import type { OfflinePack } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/lib/local-store";
import { agoLabel, packsStore } from "@/lib/offline";

/**
 * Offline packs (Settings, mockup 6a). Downloads are per device: the trip pack is what
 * this browser already caches, map and language packs are marked as kept. Sizes are estimates.
 */
export function OfflinePacks({ packs }: { packs: OfflinePack[] }) {
  const have = packsStore.use();
  const now = useNow();
  const mark = (id: string, on: boolean) => { const next = { ...packsStore.get() }; if (on) next[id] = new Date().toISOString(); else delete next[id]; packsStore.set(next); };
  return (
    <>
      {packs.map((p) => {
        const got = p.kind === "trip" ? true : Boolean(have[p.id]);
        const size = p.sizeMb ? `${p.sizeMb} MB` : null;
        const subtitle = p.kind === "trip" ? p.detail : [p.detail, size ? `≈ ${size}` : null].filter(Boolean).join(" · ");
        return (
          <div key={p.id} className="flex items-center gap-3 px-3.5 py-3">
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{p.title}</span><span className="block truncate text-[12px] text-muted">{subtitle}</span></span>
            {p.kind === "trip" ? (
              <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary"><Check aria-hidden="true" size={14} />Up to date</span>
            ) : got ? (
              <Button variant="ghost" size="sm" icon={<Check size={14} />} onClick={() => mark(p.id, false)} aria-label={`Remove ${p.title}, downloaded ${agoLabel(have[p.id]!, now)}`}>Downloaded</Button>
            ) : (
              <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => mark(p.id, true)} aria-label={`Download ${p.title}${size ? `, ${size}` : ""}${p.wifiOnly ? ", Wi-Fi only" : ""}`}>Download</Button>
            )}
          </div>
        );
      })}
    </>
  );
}
