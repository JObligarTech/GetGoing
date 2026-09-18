/**
 * Provider interfaces. Apps depend on these, never on a vendor SDK directly.
 * Mock adapters ship for dev/test; real adapters are one file each.
 */
import type { LatLng } from "../domain";

export interface PlaceSearchResult {
  provider: "osm" | "google" | "manual";
  providerRef: string;
  name: string;
  address: string | null;
  localName?: string | null;
  location: LatLng;
  kind?: string; // 'cafe' | 'restaurant' | 'attraction' ...
}
export interface GeocodeProvider {
  search(query: string, opts?: { near?: LatLng; countryCodes?: string[]; limit?: number; signal?: AbortSignal }): Promise<PlaceSearchResult[]>;
}

export interface TranslationProvider {
  translate(text: string, from: string, to: string, opts?: { signal?: AbortSignal }): Promise<{ text: string; romanized?: string }>;
}

export interface FxRate { base: string; quote: string; rate: number; asOf: string }
export interface FxProvider {
  rate(base: string, quote: string, opts?: { signal?: AbortSignal }): Promise<FxRate>;
}

export interface OcrLine { text: string; confidence: number; box?: [number, number, number, number] }
export interface OcrProvider {
  recognize(image: Blob | ArrayBuffer, opts?: { languageHints?: string[]; signal?: AbortSignal }): Promise<OcrLine[]>;
}

export interface Providers {
  geocode: GeocodeProvider;
  translation: TranslationProvider;
  fx: FxProvider;
  ocr: OcrProvider;
}
