/**
 * Translate — languages, trip-suggested pairs, context phrases ("From your trip"),
 * the "Show to driver" card and camera-line helpers. Pure functions over a TripBundle.
 */
import type { Place, Profile, Trip, TripBundle } from "./domain";
import type { PhraseRow } from "./db/database.types";
import type { OcrLine, TranslationProvider } from "./providers/types";
import { navShortcuts } from "./navigate";
import { placeById, stayForDate } from "./selectors";

export interface Language {
  code: string;
  /** English name ("Japanese") */
  name: string;
  /** Endonym, shown in the language bar ("日本語") */
  native: string;
  /** BCP 47 tag for speech recognition / synthesis */
  speech: string;
  /** Right-to-left script */
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English", speech: "en-US" },
  { code: "ja", name: "Japanese", native: "日本語", speech: "ja-JP" },
  { code: "ko", name: "Korean", native: "한국어", speech: "ko-KR" },
  { code: "zh", name: "Chinese", native: "中文", speech: "zh-CN" },
  { code: "th", name: "Thai", native: "ไทย", speech: "th-TH" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", speech: "vi-VN" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", speech: "id-ID" },
  { code: "pt", name: "Portuguese", native: "Português", speech: "pt-PT" },
  { code: "es", name: "Spanish", native: "Español", speech: "es-ES" },
  { code: "fr", name: "French", native: "Français", speech: "fr-FR" },
  { code: "de", name: "German", native: "Deutsch", speech: "de-DE" },
  { code: "it", name: "Italian", native: "Italiano", speech: "it-IT" },
  { code: "nl", name: "Dutch", native: "Nederlands", speech: "nl-NL" },
  { code: "ar", name: "Arabic", native: "العربية", speech: "ar-SA", rtl: true },
  { code: "hi", name: "Hindi", native: "हिन्दी", speech: "hi-IN" },
];

/** Country → primary language, for trips that set a country but no language. */
const COUNTRY_LANGUAGE: Record<string, string> = {
  JP: "ja", KR: "ko", CN: "zh", TW: "zh", TH: "th", VN: "vi", ID: "id", PT: "pt", BR: "pt", ES: "es", MX: "es", AR: "es", CO: "es", PE: "es", CL: "es",
  FR: "fr", BE: "fr", DE: "de", AT: "de", CH: "de", IT: "it", NL: "nl", EG: "ar", AE: "ar", SA: "ar", MA: "ar", IN: "hi", US: "en", GB: "en", AU: "en", CA: "en", IE: "en", NZ: "en",
};

export function languageByCode(code: string | null | undefined): Language | null {
  if (!code) return null;
  const base = code.toLowerCase().split("-")[0]!;
  return LANGUAGES.find((l) => l.code === base) ?? null;
}

/** "Japan" for "JP"; falls back to the code. */
export function countryName(code: string | null | undefined, locale = "en"): string | null {
  if (!code) return null;
  try { return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code; } catch { return code; }
}

export interface LanguagePair { from: Language; to: Language; reason: string | null }

/**
 * The pair the language bar opens with: the traveler's locale → the trip's language.
 * "Suggested for Japan" when it came from the trip.
 */
export function suggestLanguages(trip: Pick<Trip, "local_language" | "countries"> | null, profile: Pick<Profile, "locale"> | null): LanguagePair {
  const from = languageByCode(profile?.locale) ?? LANGUAGES[0]!;
  const country = trip?.countries[0] ?? null;
  const to = languageByCode(trip?.local_language) ?? languageByCode(country ? COUNTRY_LANGUAGE[country.toUpperCase()] : null);
  if (!to || to.code === from.code) return { from, to: LANGUAGES.find((l) => l.code !== from.code)!, reason: null };
  const where = countryName(country);
  return { from, to, reason: where ? `Suggested for ${where}` : "Suggested for this trip" };
}

/** "Please take me here" in the trip's language, for the driver card. */
export const DRIVER_PHRASE: Record<string, { text: string; romanized?: string }> = {
  en: { text: "Please take me here." },
  ja: { text: "ここまでお願いします", romanized: "Koko made onegaishimasu" },
  ko: { text: "여기로 가 주세요", romanized: "Yeogiro ga juseyo" },
  zh: { text: "请带我去这里", romanized: "Qǐng dài wǒ qù zhèlǐ" },
  th: { text: "กรุณาพาฉันไปที่นี่", romanized: "Karunā phā chan pai thī nī" },
  vi: { text: "Làm ơn đưa tôi đến đây" },
  id: { text: "Tolong antar saya ke sini" },
  pt: { text: "Leve-me aqui, por favor." },
  es: { text: "Lléveme aquí, por favor." },
  fr: { text: "Emmenez-moi ici, s'il vous plaît." },
  de: { text: "Bringen Sie mich bitte hierhin." },
  it: { text: "Mi porti qui, per favore." },
  nl: { text: "Breng me hierheen, alstublieft." },
  ar: { text: "من فضلك خذني إلى هنا" },
  hi: { text: "कृपया मुझे यहाँ ले चलिए" },
};

export interface ConversationStrings { tapToSpeak: string; listening: string; speak: string; typeInstead: string }
const CONVERSATION: Record<string, ConversationStrings> = {
  en: { tapToSpeak: "Tap to speak", listening: "Listening…", speak: "Speak", typeInstead: "Type instead" },
  ja: { tapToSpeak: "タップして話す", listening: "聞いています", speak: "話す", typeInstead: "入力する" },
  ko: { tapToSpeak: "눌러서 말하기", listening: "듣고 있어요", speak: "말하기", typeInstead: "입력하기" },
  zh: { tapToSpeak: "点击说话", listening: "正在听", speak: "说话", typeInstead: "改为输入" },
  th: { tapToSpeak: "แตะเพื่อพูด", listening: "กำลังฟัง", speak: "พูด", typeInstead: "พิมพ์แทน" },
  vi: { tapToSpeak: "Chạm để nói", listening: "Đang nghe…", speak: "Nói", typeInstead: "Nhập thay thế" },
  id: { tapToSpeak: "Ketuk untuk bicara", listening: "Mendengarkan…", speak: "Bicara", typeInstead: "Ketik saja" },
  pt: { tapToSpeak: "Toque para falar", listening: "A ouvir…", speak: "Falar", typeInstead: "Escrever" },
  es: { tapToSpeak: "Toca para hablar", listening: "Escuchando…", speak: "Hablar", typeInstead: "Escribir" },
  fr: { tapToSpeak: "Appuyez pour parler", listening: "À l'écoute…", speak: "Parler", typeInstead: "Écrire" },
  de: { tapToSpeak: "Zum Sprechen tippen", listening: "Ich höre zu…", speak: "Sprechen", typeInstead: "Stattdessen tippen" },
  it: { tapToSpeak: "Tocca per parlare", listening: "In ascolto…", speak: "Parla", typeInstead: "Scrivi" },
  nl: { tapToSpeak: "Tik om te spreken", listening: "Luisteren…", speak: "Spreek", typeInstead: "Typ in plaats daarvan" },
  ar: { tapToSpeak: "اضغط للتحدث", listening: "أستمع…", speak: "تحدث", typeInstead: "اكتب بدلاً من ذلك" },
  hi: { tapToSpeak: "बोलने के लिए टैप करें", listening: "सुन रहा हूँ…", speak: "बोलें", typeInstead: "टाइप करें" },
};
/** The other person's side of Conversation mode is labelled in their language. */
export function conversationStrings(lang: string): ConversationStrings {
  return CONVERSATION[languageByCode(lang)?.code ?? "en"] ?? CONVERSATION.en!;
}

const NON_LATIN = /[؀-ۿऀ-ॿ฀-๿぀-ヿ㐀-䶿一-鿿가-힯]/;
/** Rough script check used by "Auto-detect": text in a non-Latin script belongs to the non-Latin side of the pair. */
export function detectSide(text: string, pair: { from: Language; to: Language }): "from" | "to" {
  const nonLatinTo = /^(ja|ko|zh|th|ar|hi)$/.test(pair.to.code), nonLatinFrom = /^(ja|ko|zh|th|ar|hi)$/.test(pair.from.code);
  const hasNonLatin = NON_LATIN.test(text);
  if (nonLatinTo && !nonLatinFrom) return hasNonLatin ? "to" : "from";
  if (nonLatinFrom && !nonLatinTo) return hasNonLatin ? "from" : "to";
  return "from";
}

export interface DriverCard {
  lang: string;
  headline: string;
  romanized: string | null;
  /** Local-script name and address; fall back to the English ones when the place has none. */
  name: string;
  address: string | null;
  phone: string | null;
  /** What the traveler reads underneath */
  english: { name: string; address: string | null };
  hasLocal: boolean;
}

/** The "Show to driver" card for a place: big local-script name + address, phone, and the English underneath. */
export function driverCard(place: Place, trip: Pick<Trip, "local_language">): DriverCard {
  const lang = languageByCode(trip.local_language)?.code ?? "en";
  const phrase = DRIVER_PHRASE[lang] ?? DRIVER_PHRASE.en!;
  const hasLocal = Boolean(place.local_name || place.local_address);
  return {
    lang, headline: phrase.text, romanized: phrase.romanized ?? null,
    name: place.local_name ?? place.name, address: place.local_address ?? place.address, phone: place.phone,
    english: { name: place.name, address: place.address }, hasLocal,
  };
}

export type ContextPhraseKind = "driver" | "phrase" | "camera";
export interface ContextPhrase {
  key: string;
  kind: ContextPhraseKind;
  label: string;
  detail: string;
  /** For `driver`: the place to show. */
  placeId?: string;
  /** For `phrase`: the English text to translate. */
  text?: string;
}

/**
 * "From your trip": the hotel address for a taxi, tonight's dinner name & address,
 * a question for the next planned place, and the camera for a menu or receipt.
 */
export function contextPhrases(bundle: TripBundle, day: string, nowHHMM: string): ContextPhrase[] {
  const out: ContextPhrase[] = [];
  const stay = stayForDate(bundle.stays, day);
  const hotel = stay ? placeById(bundle, stay.place_id) : null;
  if (hotel) out.push({ key: "hotel", kind: "driver", label: "My hotel address", detail: `${hotel.name} · show to a driver`, placeId: hotel.id });
  for (const s of navShortcuts(bundle, day, nowHHMM)) {
    if (s.key === "dinner") out.push({ key: "dinner", kind: "driver", label: `${s.place.name} name & address`, detail: `Tonight's dinner${s.time ? ` · ${s.time}` : ""}`, placeId: s.place.id });
    if (s.key === "next") out.push({ key: "next", kind: "phrase", label: `${s.place.name}: "Where is the entrance?"`, detail: `Next planned${s.time ? ` · ${s.time}` : ""}`, text: "Where is the entrance?" });
  }
  out.push({ key: "camera", kind: "camera", label: "Translate a menu or receipt", detail: "Point the camera at it" });
  return out;
}

/** Saved phrases for a trip, in their saved order. */
export function phrasesForTrip(bundle: Pick<TripBundle, "phrases">): PhraseRow[] {
  return [...bundle.phrases].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export interface CameraLine {
  original: string;
  translated: string;
  /** Price found on the line, in the trip's currency. */
  price: number | null;
  confidence: number;
  box: [number, number, number, number] | null;
}

const PRICE_RE = /(?:[¥￥€£$]|\b(?:JPY|USD|EUR|KRW|IDR|GBP)\s?)?\s*(\d{1,3}(?:[,.]\d{3})+|\d+)(?:\s*(?:円|won|₩))?\s*$/;

/** Split "柚子塩らーめん ¥1,200" into the label and the number at the end of the line. */
export function splitPrice(line: string): { label: string; price: number | null } {
  const m = PRICE_RE.exec(line);
  if (!m || m.index === 0) return { label: line.trim(), price: null };
  const n = Number(m[1]!.replace(/[,.]/g, ""));
  if (!Number.isFinite(n)) return { label: line.trim(), price: null };
  return { label: line.slice(0, m.index).replace(/[\s:：·-]+$/, "").trim(), price: n };
}

/** Translate every OCR line, keeping prices as numbers so Split can reuse them. */
export async function translateLines(lines: OcrLine[], from: string, to: string, provider: TranslationProvider, opts?: { signal?: AbortSignal }): Promise<CameraLine[]> {
  return Promise.all(lines.map(async (l) => {
    const { label, price } = splitPrice(l.text);
    const t = label ? await provider.translate(label, from, to, opts) : { text: "" };
    return { original: l.text, translated: t.text, price, confidence: l.confidence, box: l.box ?? null };
  }));
}
