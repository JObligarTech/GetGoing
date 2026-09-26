import { describe, expect, it } from "vitest";
import { demoBundle, demoProfile } from "./demo";
import { mockTranslation } from "./providers/mock";
import { contextPhrases, conversationStrings, countryName, detectSide, driverCard, languageByCode, phrasesForTrip, splitPrice, suggestLanguages, translateLines } from "./translate";

describe("languages", () => {
  it("suggests the trip's language from the traveler's locale", () => {
    const s = suggestLanguages(demoBundle.trip, demoProfile);
    expect(s.from.code).toBe("en");
    expect(s.to.native).toBe("日本語");
    expect(s.reason).toBe("Suggested for Japan");
  });
  it("falls back to the country, then to any other language", () => {
    expect(suggestLanguages({ local_language: null, countries: ["KR"] }, { locale: "en" }).to.code).toBe("ko");
    expect(suggestLanguages({ local_language: "en", countries: ["US"] }, { locale: "en-US" })).toMatchObject({ to: { code: "ja" }, reason: null });
    expect(suggestLanguages(null, null).from.code).toBe("en");
  });
  it("resolves region subtags and unknown codes", () => {
    expect(languageByCode("pt-BR")?.name).toBe("Portuguese");
    expect(languageByCode("xx")).toBeNull();
    expect(countryName("JP")).toBe("Japan");
  });
  it("labels the other side in their language and detects which side typed", () => {
    expect(conversationStrings("ja").listening).toBe("聞いています");
    expect(conversationStrings("xx").tapToSpeak).toBe("Tap to speak");
    const pair = { from: languageByCode("en")!, to: languageByCode("ja")! };
    expect(detectSide("駅はどこですか", pair)).toBe("to");
    expect(detectSide("Where is the station?", pair)).toBe("from");
    expect(detectSide("Olá", { from: languageByCode("en")!, to: languageByCode("pt")! })).toBe("from");
  });
});

describe("driver card", () => {
  it("uses the local name and address with the phrase in the trip language", () => {
    const hotel = demoBundle.places[0]!;
    const c = driverCard(hotel, demoBundle.trip);
    expect(c).toMatchObject({ lang: "ja", headline: "ここまでお願いします", romanized: "Koko made onegaishimasu", name: "ホテルグレイスリー新宿", hasLocal: true });
    expect(c.english.name).toBe("Hotel Gracery Shinjuku");
  });
  it("falls back to English when the place has no local script", () => {
    const c = driverCard({ ...demoBundle.places[0]!, local_name: null, local_address: null }, { local_language: "pt" });
    expect(c).toMatchObject({ lang: "pt", name: "Hotel Gracery Shinjuku", hasLocal: false, romanized: null });
  });
});

describe("context phrases", () => {
  it("lists the hotel, tonight's dinner, the next place and the camera", () => {
    const list = contextPhrases(demoBundle, "2027-03-15", "14:41");
    expect(list.map((p) => p.key)).toEqual(["hotel", "dinner", "next", "camera"]);
    expect(list[0]).toMatchObject({ kind: "driver", label: "My hotel address", placeId: demoBundle.places[0]!.id });
    expect(list[1]!.label).toBe("Afuri Ramen Harajuku name & address");
    expect(list[2]).toMatchObject({ kind: "phrase", text: "Where is the entrance?", label: 'Shibuya Sky: "Where is the entrance?"' });
  });
  it("saved phrases keep their order", () => {
    expect(phrasesForTrip(demoBundle).map((p) => p.source_text)).toEqual(["Where is the station?", "No peanuts, please", "Table for four"]);
  });
});

describe("camera lines", () => {
  it("splits prices off the end of a line", () => {
    expect(splitPrice("柚子塩らーめん ¥1,200")).toEqual({ label: "柚子塩らーめん", price: 1200 });
    expect(splitPrice("餃子 5個 ¥600")).toEqual({ label: "餃子 5個", price: 600 });
    expect(splitPrice("合計 2,800円")).toEqual({ label: "合計", price: 2800 });
    expect(splitPrice("小麦・大豆・卵を含む")).toEqual({ label: "小麦・大豆・卵を含む", price: null });
    expect(splitPrice("1200")).toEqual({ label: "1200", price: null });
  });
  it("translates each line and keeps the price", async () => {
    const lines = await translateLines([{ text: "餃子 5個 ¥600", confidence: 0.9, box: [0, 0, 1, 0.1] }, { text: "小麦・大豆・卵を含む", confidence: 0.6 }], "ja", "en", mockTranslation);
    expect(lines[0]).toMatchObject({ translated: "Gyoza, 5 pcs", price: 600, box: [0, 0, 1, 0.1] });
    expect(lines[1]).toMatchObject({ translated: "Contains wheat, soy and egg", price: null, box: null });
  });
});
