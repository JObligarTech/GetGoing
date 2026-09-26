"use client";
/**
 * Browser speech helpers (client only). Synthesis is broadly available; recognition
 * is Chromium/Safari-only and each caller offers a typed fallback when it's missing.
 * Nothing here leaves the device except through the browser's own speech service.
 */

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speak `text` in `lang` (BCP 47). Resolves when playback ends or immediately when unsupported. */
export function speak(text: string, lang: string): Promise<boolean> {
  if (!canSpeak() || !text.trim()) return Promise.resolve(false);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().split("-")[0]!));
    if (voice) u.voice = voice;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

export interface Recognizer { start(): void; stop(): void }
interface RecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognize(): boolean {
  return recognitionCtor() !== null;
}

/** One-shot recognition in `lang`; `onResult` gets interim text with `final=false`, then the final transcript. */
export function createRecognizer(lang: string, handlers: { onResult(text: string, final: boolean): void; onEnd(): void; onError(message: string): void }): Recognizer | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  r.onresult = (e) => {
    let text = "", final = false;
    for (let i = 0; i < e.results.length; i++) { const res = e.results[i]!; text += res[0]?.transcript ?? ""; if (res.isFinal) final = true; }
    handlers.onResult(text.trim(), final);
  };
  r.onerror = (e) => handlers.onError(e.error === "not-allowed" ? "Microphone access was denied. Allow it in your browser, or type instead." : "Couldn't hear that. Try again, or type instead.");
  r.onend = () => handlers.onEnd();
  return { start: () => r.start(), stop: () => r.stop() };
}
