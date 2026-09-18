/** Deterministic mock adapters — no network, no keys. Used by dev, unit and e2e tests. */
import type { FxProvider, GeocodeProvider, OcrProvider, PlaceSearchResult, TranslationProvider } from "./types";

const TOKYO_PLACES: PlaceSearchResult[] = [
  { provider: "osm", providerRef: "n1", name: "Fuglen Tokyo", localName: "フグレン トウキョウ", address: "1-2-10 Tomigaya, Shibuya", location: { lat: 35.669, lng: 139.6893 }, kind: "cafe" },
  { provider: "osm", providerRef: "n2", name: "Cafe Kitsuné Aoyama", localName: "カフェ キツネ", address: "4-3-5 Minamiaoyama, Minato", location: { lat: 35.6668, lng: 139.714 }, kind: "cafe" },
  { provider: "osm", providerRef: "n3", name: "Shibuya Sky", localName: "渋谷スカイ", address: "2-1-1 Shibuya", location: { lat: 35.6586, lng: 139.7022 }, kind: "attraction" },
  { provider: "osm", providerRef: "n4", name: "Afuri Ramen Harajuku", localName: "AFURI 原宿", address: "3-63-1 Sendagaya, Shibuya", location: { lat: 35.6706, lng: 139.7059 }, kind: "restaurant" },
  { provider: "osm", providerRef: "n5", name: "Meiji Jingu", localName: "明治神宮", address: "1-1 Yoyogikamizonocho, Shibuya", location: { lat: 35.6764, lng: 139.6993 }, kind: "attraction" },
  { provider: "osm", providerRef: "n6", name: "teamLab Planets", localName: "チームラボプラネッツ", address: "6-1-16 Toyosu, Koto", location: { lat: 35.6491, lng: 139.7898 }, kind: "attraction" },
  { provider: "osm", providerRef: "n7", name: "Luke's Lobster Omotesando", localName: "ルークス ロブスター", address: "5-2-8 Jingumae, Shibuya", location: { lat: 35.6667, lng: 139.7086 }, kind: "restaurant" },
  { provider: "osm", providerRef: "n8", name: "Pokémon Center Shibuya", localName: "ポケモンセンターシブヤ", address: "Shibuya PARCO 6F", location: { lat: 35.662, lng: 139.6987 }, kind: "shop" },
];

export const mockGeocode: GeocodeProvider = {
  async search(query, opts) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return TOKYO_PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.kind?.includes(q)).slice(0, opts?.limit ?? 8);
  },
};

const PHRASES: Record<string, { text: string; romanized: string }> = {
  "can we have separate checks, please?": { text: "別々に会計できますか？", romanized: "Betsubetsu ni kaikei dekimasu ka?" },
  "take me to this address, please.": { text: "この住所までお願いします。", romanized: "Kono jūsho made onegaishimasu." },
  "where is the station?": { text: "駅はどこですか？", romanized: "Eki wa doko desu ka?" },
  "thank you": { text: "ありがとうございます", romanized: "Arigatō gozaimasu" },
};
export const mockTranslation: TranslationProvider = {
  async translate(text, _from, to) {
    const hit = PHRASES[text.trim().toLowerCase()];
    if (to === "ja" && hit) return hit;
    return { text: `[${to}] ${text}` };
  },
};

const RATES: Record<string, number> = { "USD:JPY": 149.7, "USD:EUR": 0.92, "USD:IDR": 15600, "USD:GBP": 0.79 };
export const mockFx: FxProvider = {
  async rate(base, quote) {
    if (base === quote) return { base, quote, rate: 1, asOf: new Date(0).toISOString() };
    const direct = RATES[`${base}:${quote}`];
    const inverse = RATES[`${quote}:${base}`];
    const rate = direct ?? (inverse ? 1 / inverse : undefined);
    if (rate === undefined) throw new Error(`No mock rate for ${base}→${quote}`);
    return { base, quote, rate, asOf: "2026-09-18T00:00:00Z" };
  },
};

export const mockOcr: OcrProvider = {
  async recognize() {
    return [
      { text: "AFURI 原宿", confidence: 0.98 },
      { text: "柚子塩らーめん 1,200", confidence: 0.95 },
      { text: "餃子 600", confidence: 0.93 },
      { text: "生ビール 700", confidence: 0.6 },
      { text: "コーラ 300", confidence: 0.97 },
      { text: "合計 ¥2,800", confidence: 0.99 },
    ];
  },
};

export const mockProviders = { geocode: mockGeocode, translation: mockTranslation, fx: mockFx, ocr: mockOcr };
