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

/** English ↔ Japanese phrasebook (both directions) plus the menu words the camera mock reads. */
const PHRASES: Record<string, { text: string; romanized: string }> = {
  "Can we have separate checks, please?": { text: "別々に会計できますか？", romanized: "Betsubetsu ni kaikei dekimasu ka?" },
  "Take me to this address, please.": { text: "この住所までお願いします。", romanized: "Kono jūsho made onegaishimasu." },
  "Please take me here.": { text: "ここまでお願いします", romanized: "Koko made onegaishimasu" },
  "Where is the station?": { text: "駅はどこですか？", romanized: "Eki wa doko desu ka?" },
  "Where is the entrance?": { text: "入口はどこですか？", romanized: "Iriguchi wa doko desu ka?" },
  "No peanuts, please": { text: "ピーナッツ抜きでお願いします", romanized: "Pīnattsu nuki de onegaishimasu" },
  "Table for four": { text: "4人です", romanized: "Yonin desu" },
  "Thank you": { text: "ありがとうございます", romanized: "Arigatō gozaimasu" },
  "Hello": { text: "こんにちは", romanized: "Konnichiwa" },
  "Excuse me": { text: "すみません", romanized: "Sumimasen" },
  "How much is this?": { text: "これはいくらですか？", romanized: "Kore wa ikura desu ka?" },
  "I have a reservation.": { text: "予約しています", romanized: "Yoyaku shite imasu" },
  "The check, please.": { text: "お会計をお願いします", romanized: "Okaikei o onegaishimasu" },
  "Does this contain peanuts?": { text: "これにピーナッツは入っていますか？", romanized: "Kore ni pīnattsu wa haitte imasu ka?" },
  "Yuzu Shio Ramen": { text: "柚子塩らーめん", romanized: "Yuzu shio rāmen" },
  "Tsukemen (dipping noodles)": { text: "つけ麺", romanized: "Tsukemen" },
  "Gyoza": { text: "餃子", romanized: "Gyōza" },
  "Gyoza, 5 pcs": { text: "餃子 5個", romanized: "Gyōza go-ko" },
  "Extra chashu": { text: "チャーシュー追加", romanized: "Chāshū tsuika" },
  "Draft beer": { text: "生ビール", romanized: "Nama bīru" },
  "Cola": { text: "コーラ", romanized: "Kōra" },
  "Coke": { text: "コーラ", romanized: "Kōra" },
  "Tsukemen": { text: "つけ麺", romanized: "Tsukemen" },
  "Subtotal": { text: "小計", romanized: "Shōkei" },
  "Tax 10%": { text: "消費税10%", romanized: "Shōhizei jup-pāsento" },
  "Total": { text: "合計", romanized: "Gōkei" },
  "Contains wheat, soy and egg": { text: "小麦・大豆・卵を含む", romanized: "Komugi, daizu, tamago o fukumu" },
};
const norm = (s: string) => s.trim().toLowerCase().replace(/[。？?！!.]+$/u, "");
const EN_JA = new Map(Object.entries(PHRASES).map(([en, ja]) => [norm(en), { en, ...ja }]));
// First entry wins for the reverse direction ("コーラ" → "Cola", not "Coke").
const JA_EN = new Map<string, string>();
for (const [en, ja] of Object.entries(PHRASES)) if (!JA_EN.has(norm(ja.text))) JA_EN.set(norm(ja.text), en);
export const mockTranslation: TranslationProvider = {
  async translate(text, from, to) {
    const key = norm(text);
    if (to === "ja" && from !== "ja") { const hit = EN_JA.get(key); if (hit) return { text: hit.text, romanized: hit.romanized, source: "mock" }; }
    if (to === "en" && from !== "en") { const hit = JA_EN.get(key); if (hit) return { text: hit, source: "mock" }; }
    // Outside the phrasebook the mock hands the text back and says so; the UI shows a "demo" note instead of a fake translation.
    return { text, source: "mock", approximate: from !== to };
  },
};

/** USD-based table; other pairs triangulate through USD. `asOf` is fixed so "Updated …" is deterministic in tests. */
const RATES: Record<string, number> = {
  "USD:JPY": 149.7, "USD:EUR": 0.92, "USD:IDR": 15600, "USD:GBP": 0.79, "USD:KRW": 1342, "USD:THB": 36.2, "USD:VND": 24800, "USD:INR": 83.5,
  "USD:AUD": 1.52, "USD:CAD": 1.36, "USD:CNY": 7.24, "USD:CHF": 0.88, "USD:SGD": 1.34, "USD:TWD": 32.1, "USD:MXN": 17.1, "USD:BRL": 5.1, "USD:NZD": 1.64, "USD:HKD": 7.8, "USD:PHP": 56.3,
};
export const MOCK_FX_AS_OF = "2027-03-03T05:39:00Z";
const usdRate = (code: string): number | undefined => (code === "USD" ? 1 : RATES[`USD:${code}`]);
export const mockFx: FxProvider = {
  async rate(base, quote) {
    if (base === quote) return { base, quote, rate: 1, asOf: MOCK_FX_AS_OF };
    const b = usdRate(base), q = usdRate(quote);
    if (b === undefined || q === undefined) throw new Error(`No mock rate for ${base}→${quote}`);
    return { base, quote, rate: q / b, asOf: MOCK_FX_AS_OF };
  },
};

/** The same shop's receipt: quantities, a misread line (つけ麹 for つけ麺) and the tax/total block. */
const RECEIPT_LINES = [
  { text: "AFURI 原宿", confidence: 0.98 },
  { text: "2027/03/15 19:48", confidence: 0.9 },
  { text: "柚子塩らーめん ×2 ¥2,400", confidence: 0.96 },
  { text: "餃子 ×1 ¥600", confidence: 0.95 },
  { text: "生ビール ×2 ¥1,400", confidence: 0.93 },
  { text: "コーラ ×1 ¥300", confidence: 0.97 },
  { text: "つけ麹 ×1 ¥1,350", confidence: 0.55 },
  { text: "小計 ¥6,050", confidence: 0.99 },
  { text: "消費税10% ¥605", confidence: 0.97 },
  { text: "合計 ¥6,655", confidence: 0.99 },
];

/** A ramen-shop menu; boxes are [x, y, w, h] as fractions of the image so the overlay can be drawn on any photo. */
export const mockOcr: OcrProvider = {
  async recognize(_image, opts) {
    if (opts?.document === "receipt") return RECEIPT_LINES;
    return [
      { text: "AFURI 原宿", confidence: 0.98, box: [0.08, 0.06, 0.5, 0.07] },
      { text: "柚子塩らーめん ¥1,200", confidence: 0.95, box: [0.08, 0.22, 0.84, 0.08] },
      { text: "つけ麺 ¥1,350", confidence: 0.94, box: [0.08, 0.36, 0.84, 0.08] },
      { text: "餃子 5個 ¥600", confidence: 0.93, box: [0.08, 0.5, 0.84, 0.08] },
      { text: "チャーシュー追加 ¥300", confidence: 0.9, box: [0.08, 0.64, 0.84, 0.08] },
      { text: "小麦・大豆・卵を含む", confidence: 0.6, box: [0.08, 0.82, 0.7, 0.06] },
    ];
  },
};

export const mockProviders = { geocode: mockGeocode, translation: mockTranslation, fx: mockFx, ocr: mockOcr };
