"use client";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bookmark, BookmarkCheck, Camera, Car, Languages, MessageSquareText, Mic, MicOff, Sparkles, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { languageByCode, type ContextPhrase, type Language, type Phrase, type Translation } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Card, Chip, IconCoin, ListRow, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { useCapability } from "@/lib/local-store";
import { canRecognize, createRecognizer, type Recognizer } from "@/lib/speech";
import { cx } from "@/lib/utils";
import { CopyButton, LanguageBar, SpeakButton } from "./shared";

export interface TranslatorProps {
  tripId: string;
  tripName: string;
  pair: { from: string; to: string; reason: string | null };
  phrases: Phrase[];
  context: ContextPhrase[];
  initialText?: string;
  translateAction: (input: unknown) => Promise<Translation | { error: string }>;
  savePhraseAction: (input: unknown) => Promise<Phrase | { error: string }>;
  removePhraseAction: (tripId: unknown, phraseId: unknown) => Promise<{ ok: true } | { error: string }>;
}

const MAX = 500;

/**
 * Translate — text mode. The language bar opens on the trip's language, the textarea
 * auto-translates after a pause, and the green result card carries Speak / Copy / Save.
 * Saved phrases are trip-scoped chips; "From your trip" links the hotel, dinner and next stop.
 */
export function Translator({ tripId, tripName, pair, phrases: initialPhrases, context, initialText = "", translateAction, savePhraseAction, removePhraseAction }: TranslatorProps) {
  const reduce = useReducedMotion();
  const [from, setFrom] = useState<Language>(() => languageByCode(pair.from)!);
  const [to, setTo] = useState<Language>(() => languageByCode(pair.to)!);
  const [reason, setReason] = useState(pair.reason);
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<(Translation & { source_text: string; from: string; to: string }) | null>(null);
  const [phrases, setPhrases] = useState(initialPhrases);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const micAvailable = useCapability(canRecognize);
  const [pending, start] = useTransition();
  const recognizer = useRef<Recognizer | null>(null);
  const textareaId = useId();
  const counterId = useId();

  const run = useCallback((t: string, f: Language, tt: Language) => {
    const trimmed = t.trim();
    if (!trimmed) { setResult(null); setError(null); return; }
    start(async () => {
      const r = await translateAction({ text: trimmed, from: f.code, to: tt.code });
      if ("error" in r) { setError(r.error); return; }
      setError(null);
      setResult({ ...r, source_text: trimmed, from: f.code, to: tt.code });
    });
  }, [translateAction]);

  // Auto-translate after a pause in typing (the button and ⌘/Ctrl+Enter translate immediately).
  useEffect(() => {
    if (!text.trim()) { return; }
    const id = setTimeout(() => run(text, from, to), 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, from.code, to.code]);

  const changeLang = (side: "from" | "to", code: string) => {
    const l = languageByCode(code); if (!l) return;
    setReason(null);
    if (side === "from") { if (l.code === to.code) setTo(from); setFrom(l); } else { if (l.code === from.code) setFrom(to); setTo(l); }
  };
  const swap = () => {
    setReason(null);
    const nextText = result?.text && !result.approximate ? result.text : text;
    setFrom(to); setTo(from); setText(nextText); setResult(null);
    setStatus(`Now translating ${to.name} to ${from.name}.`);
  };

  const saved = result ? phrases.find((p) => p.source_text === result.source_text && p.target_lang === result.to) ?? null : null;
  const save = () => {
    if (!result || result.approximate) return;
    start(async () => {
      const r = await savePhraseAction({ tripId, sourceText: result.source_text, sourceLang: result.from, targetText: result.text, targetLang: result.to, romanized: result.romanized ?? null });
      if ("error" in r) { setError(r.error); return; }
      setPhrases((p) => [...p, r]);
      setStatus(`Saved "${r.source_text}" to ${tripName}.`);
    });
  };
  const remove = (p: Phrase) => start(async () => {
    const r = await removePhraseAction(tripId, p.id);
    if ("error" in r) { setError(r.error); return; }
    setPhrases((list) => list.filter((x) => x.id !== p.id));
    setStatus(`Removed "${p.source_text}".`);
  });
  const load = (p: Phrase) => {
    const f = languageByCode(p.source_lang) ?? from, t = languageByCode(p.target_lang) ?? to;
    setFrom(f); setTo(t); setReason(null); setText(p.source_text);
    setResult({ text: p.target_text, romanized: p.romanized ?? undefined, source: "live", source_text: p.source_text, from: f.code, to: t.code });
  };

  const toggleMic = () => {
    if (listening) { recognizer.current?.stop(); return; }
    const r = createRecognizer(from.speech, {
      onResult: (t, final) => { setText(t); if (final) run(t, from, to); },
      onEnd: () => { setListening(false); recognizer.current = null; },
      onError: (m) => { setError(m); },
    });
    if (!r) { setError("Voice input isn't available in this browser. Type instead, or use the mobile app."); return; }
    recognizer.current = r; setListening(true); setError(null); r.start();
  };

  const remaining = MAX - text.length;
  const contextIcon = { driver: <Car size={20} />, phrase: <Sparkles size={20} />, camera: <Camera size={20} /> };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3.5 px-4 pt-4 pb-6 md:px-7 md:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-8">
      <div className="flex flex-col gap-3.5 lg:col-start-1">
        <PageHeader eyebrow={tripName} title="Translate" action={<Chip>{to.native} ready</Chip>} />
        <LanguageBar from={from} to={to} reason={reason} onChange={changeLang} onSwap={swap} />

        <Card className="flex flex-col gap-2 p-3.5">
          <label htmlFor={textareaId} className="sr-only">Text to translate</label>
          <textarea
            id={textareaId}
            value={text}
            maxLength={MAX}
            rows={4}
            lang={from.code}
            dir={from.rtl ? "rtl" : undefined}
            placeholder={`Type in ${from.name}…`}
            aria-describedby={counterId}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(text, from, to); } }}
            className="min-h-[112px] w-full resize-y rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-[17px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-primary"
          />
          <div className="flex items-center justify-between gap-2">
            <p id={counterId} className={cx("text-[12px] font-semibold", remaining < 40 ? "text-danger" : "text-muted")}>{text.length} / {MAX}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon={listening ? <MicOff size={16} /> : <Mic size={16} />} aria-pressed={listening} onClick={toggleMic} title={micAvailable ? undefined : "Voice input isn't available in this browser"}>{listening ? "Stop" : "Speak"}</Button>
              <Button size="sm" onClick={() => run(text, from, to)} loading={pending && !!text.trim()} disabled={!text.trim()}>Translate</Button>
            </div>
          </div>
        </Card>

        {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</p>}
        <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>

        {result && (
            <motion.section
              key={`${result.source_text}-${result.to}`}
              aria-label={`Translation to ${to.name}`}
              initial={reduce ? false : { y: 8 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col gap-3 rounded-2xl bg-primary p-5 text-on-primary"
            >
              <p className="text-[12px] font-bold uppercase tracking-wide text-on-primary/80">{to.native}</p>
              <p lang={result.to} dir={to.rtl ? "rtl" : undefined} className="text-[28px] leading-tight font-extrabold tracking-[-0.01em] text-balance md:text-[32px]">{result.text}</p>
              {result.romanized && <p className="text-[15px] font-medium text-on-primary/85">{result.romanized}</p>}
              {result.approximate && (
                <p role="note" className="rounded-lg bg-black/15 px-3 py-2 text-[12.5px] font-semibold leading-snug">
                  Demo mode: this phrase isn&apos;t in the offline phrasebook, so it&apos;s shown as typed. Connect a translation provider for live results.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <SpeakButton text={result.text} lang={to.speech} />
                <CopyButton text={result.text} onDone={setStatus} />
                {saved ? (
                  <Button variant="light" size="sm" icon={<Trash2 size={16} />} onClick={() => remove(saved)}>Remove from saved</Button>
                ) : (
                  <Button variant="light" size="sm" icon={<Bookmark size={16} />} onClick={save} disabled={!!result.approximate} title={result.approximate ? "Demo results can't be saved" : undefined}>Save phrase</Button>
                )}
              </div>
            </motion.section>
        )}

        <div className="lg:hidden">
          <SavedPhrases phrases={phrases} current={saved?.id ?? null} onPick={load} />
        </div>

        <nav aria-label="Translate modes" className="sticky bottom-[calc(84px+env(safe-area-inset-bottom)+8px)] z-10 mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card md:static">
          <Link href={"/translate/conversation" as Route} className="flex h-12 items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-ink hover:bg-tint"><MessageSquareText size={18} aria-hidden="true" />Conversation</Link>
          <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? "Stop listening" : `Speak in ${from.name}`} className={cx("inline-flex h-14 w-14 items-center justify-center rounded-full text-on-primary shadow-card transition-colors duration-(--dur-fast)", listening ? "bg-danger" : "bg-primary hover:bg-primary-hover")}>
            {listening ? <MicOff size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}
          </button>
          <Link href={"/translate/camera" as Route} className="flex h-12 items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-ink hover:bg-tint"><Camera size={18} aria-hidden="true" />Camera</Link>
        </nav>
      </div>

      <aside aria-labelledby="from-trip-title" className="flex flex-col gap-3.5 lg:col-start-2 lg:sticky lg:top-7">
        <SectionHeader id="from-trip-title" title="From your trip" />
        <Card className="divide-y divide-line">
          {context.map((c) => {
            const common = { leading: <IconCoin>{contextIcon[c.kind]}</IconCoin>, title: c.label, subtitle: c.detail, chevron: true } as const;
            if (c.kind === "driver") return <ListRow key={c.key} href={`/translate/driver?place=${c.placeId}`} {...common} />;
            if (c.kind === "camera") return <ListRow key={c.key} href="/translate/camera" {...common} />;
            return <ListRow key={c.key} onClick={() => { setText(c.text ?? ""); setStatus(`Translating "${c.text}".`); }} {...common} />;
          })}
        </Card>
        <div className="hidden lg:block">
          <SavedPhrases phrases={phrases} current={saved?.id ?? null} onPick={load} />
        </div>
        <p className="flex items-start gap-2 text-[12px] leading-snug text-muted"><Languages size={14} aria-hidden="true" className="mt-0.5 shrink-0" />Saved phrases belong to the trip, so everyone travelling with you sees them.</p>
      </aside>
    </div>
  );
}

function SavedPhrases({ phrases, current, onPick }: { phrases: Phrase[]; current: string | null; onPick: (p: Phrase) => void }) {
  return (
    <section aria-labelledby="saved-phrases-title" className="flex flex-col gap-2">
      <SectionHeader id="saved-phrases-title" title="Saved phrases" />
      {phrases.length ? (
        <ul className="flex flex-wrap gap-2">
          {phrases.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)} aria-pressed={p.id === current} className={cx("inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors duration-(--dur-fast)", p.id === current ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-tint")}>
                {p.id === current ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
                {p.source_text}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Translate something and tap Save phrase to keep it here.</p>
      )}
    </section>
  );
}
