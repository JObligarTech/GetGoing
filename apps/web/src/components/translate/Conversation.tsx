"use client";
import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Mic, MicOff, Send, Volume2, VolumeX, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { conversationStrings, detectSide, languageByCode, type Translation } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { useCapability } from "@/lib/local-store";
import { canRecognize, canSpeak, createRecognizer, speak, type Recognizer } from "@/lib/speech";
import { cx } from "@/lib/utils";

interface Turn { id: number; side: "from" | "to"; text: string; translated: string; romanized?: string; approximate?: boolean }

export interface ConversationProps {
  tripName: string;
  pair: { from: string; to: string };
  translateAction: (input: unknown) => Promise<Translation | { error: string }>;
}

/**
 * Conversation mode: the top half is turned 180° toward the other person and labelled in
 * their language; each side has a big mic (Web Speech) and a typed fallback. Every turn is
 * translated through the server action and read aloud in the other language.
 */
export function Conversation({ tripName, pair, translateAction }: ConversationProps) {
  const from = languageByCode(pair.from)!, to = languageByCode(pair.to)!;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState<"from" | "to" | null>(null);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [autoDetect, setAutoDetect] = useState(true);
  const [muted, setMuted] = useState(false);
  const micOk = useCapability(canRecognize), ttsOk = useCapability(canSpeak);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const recognizer = useRef<Recognizer | null>(null);
  const seq = useRef(0);
  const inputId = useId();
  const theirs = conversationStrings(to.code), mine = conversationStrings(from.code);

  const say = (side: "from" | "to", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const src = side === "from" ? from : to, dst = side === "from" ? to : from;
    start(async () => {
      const r = await translateAction({ text: trimmed, from: src.code, to: dst.code });
      if ("error" in r) { setError(r.error); return; }
      setError(null);
      setTurns((t) => [...t, { id: ++seq.current, side, text: trimmed, translated: r.text, romanized: r.romanized, approximate: r.approximate }]);
      if (!muted && !r.approximate) void speak(r.text, dst.speech);
    });
  };

  const toggleMic = (side: "from" | "to") => {
    if (listening) { recognizer.current?.stop(); return; }
    const lang = side === "from" ? from : to;
    const r = createRecognizer(lang.speech, {
      onResult: (t, final) => { setInterim(t); if (final) { setInterim(""); say(side, t); } },
      onEnd: () => { setListening(null); setInterim(""); recognizer.current = null; },
      onError: (m) => setError(m),
    });
    if (!r) { setError("Voice input isn't available in this browser. Type below instead; the other person can type too."); return; }
    recognizer.current = r; setListening(side); setError(null); r.start();
  };

  const submitTyped = () => {
    const side = autoDetect ? detectSide(typed, { from, to }) : "from";
    say(side, typed);
    setTyped("");
  };

  const lastForThem = [...turns].reverse().find((t) => t.side === "from");
  const lastForMe = [...turns].reverse().find((t) => t.side === "to");
  return (
    <div className="flex min-h-[calc(100dvh-84px)] flex-col md:min-h-dvh">
      <h1 className="sr-only">Conversation</h1>
      {/* Their half: rotated toward the person across the table; reading order stays natural for assistive tech. */}
      <section aria-label={`${to.name} side, facing the other person`} lang={to.code} dir={to.rtl ? "rtl" : undefined} className="flex flex-1 rotate-180 flex-col items-center justify-between gap-4 bg-[#121614] px-5 py-6 text-[#F1F3EF]">
        <div className="flex w-full items-center justify-between text-[13px] font-bold text-[#C9D3CC]">
          <span>{to.native}</span>
          <span aria-live="polite">{listening === "to" ? theirs.listening : theirs.tapToSpeak}</span>
        </div>
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-2 text-center" aria-live="polite">
          {listening === "to" && interim ? <p className="text-[20px] text-[#C9D3CC]">{interim}</p> : lastForThem ? (
            <>
              <p className="text-[30px] leading-tight font-extrabold text-balance md:text-[36px]">{lastForThem.translated}</p>
              {lastForThem.romanized && <p className="text-[15px] text-[#C9D3CC]">{lastForThem.romanized}</p>}
            </>
          ) : <p className="text-[18px] text-[#98A39C]">{theirs.tapToSpeak}</p>}
        </div>
        <MicButton side="to" name={to.name} label={theirs.speak} on={listening === "to"} onToggle={toggleMic} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line bg-surface px-4 py-2">
        <Link href={"/translate" as Route} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-bold text-ink hover:bg-tint"><X size={16} aria-hidden="true" />Close</Link>
        <p className="rounded-full bg-tint px-3 py-1 text-[12.5px] font-bold text-on-tint">{from.native} ⇄ {to.native}</p>
        <div className="flex items-center gap-1">
          <button type="button" role="switch" aria-checked={autoDetect} onClick={() => setAutoDetect((v) => !v)} className={cx("inline-flex h-10 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-bold", autoDetect ? "text-primary" : "text-muted")}>
            <span aria-hidden="true" className={cx("inline-block h-4 w-7 rounded-full p-0.5 transition-colors", autoDetect ? "bg-primary" : "bg-line-strong")}><span className={cx("block h-3 w-3 rounded-full bg-white transition-transform", autoDetect && "translate-x-3")} /></span>
            Auto-detect {autoDetect ? "on" : "off"}
          </button>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? "Unmute spoken translations" : "Mute spoken translations"} disabled={!ttsOk} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-tint disabled:opacity-40">
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <section aria-label={`${from.name} side`} lang={from.code} className="flex flex-1 flex-col items-center justify-between gap-4 bg-canvas px-5 py-6">
        <div className="flex w-full items-center justify-between text-[13px] font-bold text-muted">
          <span>{tripName}</span>
          <span aria-live="polite">{listening === "from" ? mine.listening : pending ? "Translating…" : mine.tapToSpeak}</span>
        </div>
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-2 text-center" aria-live="polite">
          {listening === "from" && interim ? <p className="text-[20px] text-muted">{interim}</p> : lastForMe ? (
            <>
              <p className="text-[13px] font-semibold text-muted" lang={to.code}>{lastForMe.text}</p>
              <p className="text-[30px] leading-tight font-extrabold text-balance md:text-[36px]">{lastForMe.translated}</p>
              {lastForMe.approximate && <p role="note" className="text-[12.5px] font-semibold text-muted">Demo mode: shown as typed; connect a translation provider for live results.</p>}
            </>
          ) : <p className="text-[18px] text-muted">{mine.tapToSpeak}</p>}
        </div>
        {error && <p role="alert" className="text-center text-[13px] font-semibold text-danger">{error}</p>}
        <MicButton side="from" name={from.name} label={mine.speak} on={listening === "from"} onToggle={toggleMic} />
        <form className="flex w-full max-w-[560px] items-end gap-2" onSubmit={(e) => { e.preventDefault(); submitTyped(); }}>
          <label htmlFor={inputId} className="sr-only">{mine.typeInstead}</label>
          <input id={inputId} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={micOk ? mine.typeInstead : `${mine.typeInstead} (no microphone here)`} maxLength={500} className="h-12 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] outline-none placeholder:text-faint focus:border-primary" />
          <Button type="submit" size="md" icon={<Send size={16} />} disabled={!typed.trim()} loading={pending}>Send</Button>
        </form>
      </section>

      {turns.length > 0 && (
        <section aria-labelledby="transcript-title" className="border-t border-line bg-surface px-4 py-3">
          <h2 id="transcript-title" className="text-eyebrow">Transcript</h2>
          <ol className="mt-2 flex flex-col gap-1.5 text-[13px]">
            {turns.map((t) => (
              <li key={t.id} className="flex gap-2">
                <span className="w-16 shrink-0 font-bold text-muted">{t.side === "from" ? "You" : to.name}</span>
                <span><span lang={t.side === "from" ? from.code : to.code}>{t.text}</span> <span aria-hidden="true">→</span> <span className="sr-only">translated as</span> <span lang={t.side === "from" ? to.code : from.code} className="font-semibold">{t.translated}</span></span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function MicButton({ side, name, label, on, onToggle }: { side: "from" | "to"; name: string; label: string; on: boolean; onToggle: (side: "from" | "to") => void }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex">
      {/* The pulse lives on a decorative ring so the button itself stays still for pointer and assistive tech. */}
      {on && !reduce && <motion.span aria-hidden="true" className="absolute inset-0 rounded-full bg-danger/40" animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }} />}
      <motion.button
        type="button"
        onClick={() => onToggle(side)}
        aria-pressed={on}
        aria-label={on ? `Stop listening (${name})` : `${label} (${name})`}
        whileTap={reduce ? undefined : { scale: 0.96 }}
        className={cx("relative inline-flex h-20 w-20 items-center justify-center rounded-full shadow-card transition-colors duration-(--dur-fast)", on ? "bg-danger text-white" : side === "to" ? "bg-[#F1F3EF] text-[#121614]" : "bg-primary text-on-primary hover:bg-primary-hover")}
      >
        {on ? <MicOff size={30} aria-hidden="true" /> : <Mic size={30} aria-hidden="true" />}
      </motion.button>
    </span>
  );
}
