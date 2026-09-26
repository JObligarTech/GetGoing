"use client";
import { useState } from "react";
import { ArrowLeftRight, Copy, Volume2 } from "lucide-react";
import { LANGUAGES, type Language } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { useCapability } from "@/lib/local-store";
import { canSpeak, speak } from "@/lib/speech";
import { cx } from "@/lib/utils";

function LanguageSelect({ side, value, onChange }: { side: "from" | "to"; value: Language; onChange: (side: "from" | "to", code: string) => void }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{side === "from" ? "From" : "To"}</span>
      <select value={value.code} onChange={(e) => onChange(side, e.target.value)} className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-bold text-ink outline-none focus:border-primary">
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}{l.native !== l.name ? ` · ${l.name}` : ""}</option>)}
      </select>
    </label>
  );
}

/** From ⇄ To selects with a swap button; the suggestion chip explains where the default came from. */
export function LanguageBar({ from, to, reason, onChange, onSwap, compact }: { from: Language; to: Language; reason: string | null; onChange: (side: "from" | "to", code: string) => void; onSwap: () => void; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cx("flex items-end gap-2", compact && "gap-1.5")}>
        <LanguageSelect side="from" value={from} onChange={onChange} />
        <button type="button" onClick={onSwap} aria-label="Swap languages" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors duration-(--dur-fast) hover:bg-tint"><ArrowLeftRight size={18} aria-hidden="true" /></button>
        <LanguageSelect side="to" value={to} onChange={onChange} />
      </div>
      {reason && <p className="text-[12px] font-semibold text-primary">{reason}</p>}
    </div>
  );
}

/** Speak with the browser's speech synthesis; disabled with an explanation when unsupported. */
export function SpeakButton({ text, lang, label = "Speak", variant = "light", size = "sm", full }: { text: string; lang: string; label?: string; variant?: "light" | "secondary" | "translucent" | "ink"; size?: "sm" | "md"; full?: boolean }) {
  const supported = useCapability(canSpeak);
  const [speaking, setSpeaking] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} full={full} icon={<Volume2 size={16} />} disabled={!supported || !text} aria-pressed={speaking} title={supported ? undefined : "Speech isn't available in this browser"} onClick={async () => { setSpeaking(true); await speak(text, lang); setSpeaking(false); }}>
        {label}
      </Button>
      {!supported && <span className="sr-only">Speech isn&apos;t available in this browser.</span>}
    </>
  );
}

/** Clipboard copy with a spoken confirmation. */
export function CopyButton({ text, label = "Copy", variant = "light", size = "sm", onDone }: { text: string; label?: string; variant?: "light" | "secondary"; size?: "sm" | "md"; onDone?: (message: string) => void }) {
  return (
    <Button variant={variant} size={size} icon={<Copy size={16} />} disabled={!text} onClick={async () => {
      try { await navigator.clipboard.writeText(text); onDone?.("Copied to clipboard"); } catch { onDone?.("Couldn't copy. Select the text instead."); }
    }}>{label}</Button>
  );
}
