"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Camera, ImageIcon, Receipt, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { convert, formatMoney, languageByCode, type CachedRate, type CameraLine } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Chip, PageHeader } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";

export interface CameraTranslateProps {
  tripName: string;
  from: string;
  to: string;
  localCurrency: string | null;
  homeCurrency: string;
  rate: CachedRate | null;
  recognizeAction: (formData: FormData) => Promise<{ lines: CameraLine[]; from: string; to: string } | { error: string }>;
  /** Camera → Split: starts a draft bill from the priced lines (Atlas Premium Pass). */
  splitAction?: (lines: unknown, placeId: unknown) => Promise<{ error: string } | undefined | void>;
  canSplit?: boolean;
}

type View = "overlay" | "text";

/**
 * Camera translation. A photo (taken or chosen) goes to the server action, which reads
 * it with the OCR provider and translates each line; nothing is stored. Overlay draws the
 * translations over the photo; Text lists them with prices in both currencies.
 */
export function CameraTranslate({ tripName, from, to, localCurrency, homeCurrency, rate, recognizeAction, splitAction, canSplit }: CameraTranslateProps) {
  const reduce = useReducedMotion();
  const [image, setImage] = useState<{ url: string; alt: string } | null>(null);
  const [lines, setLines] = useState<CameraLine[] | null>(null);
  const [view, setView] = useState<View>("overlay");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const takeRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const fromLang = languageByCode(from)!, toLang = languageByCode(to)!;

  useEffect(() => () => { if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url); }, [image]);

  const submit = (fd: FormData) => {
    fd.set("from", from); fd.set("to", to);
    setStatus("Reading the photo…"); setError(null); setLines(null);
    start(async () => {
      const r = await recognizeAction(fd);
      if ("error" in r) { setError(r.error); setStatus(""); return; }
      setLines(r.lines);
      setStatus(`Found ${r.lines.length} lines. ${r.lines.filter((l) => l.price != null).length} have prices.`);
    });
  };
  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
    setImage({ url: URL.createObjectURL(file), alt: "Your photo" });
    const fd = new FormData(); fd.set("image", file); submit(fd);
  };
  const sample = () => {
    setImage({ url: "/samples/afuri-menu.svg", alt: "Sample menu from Afuri Ramen with five items and an allergen line" });
    const fd = new FormData(); fd.set("sample", "1"); submit(fd);
  };

  const price = (n: number | null) => {
    if (n == null || !localCurrency) return null;
    const local = formatMoney(n, localCurrency);
    if (!rate || rate.base !== localCurrency || rate.quote === localCurrency) return local;
    return `${local} ≈ ${formatMoney(convert(n, rate.rate, rate.quote), rate.quote)}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-3.5 px-4 pt-4 pb-6 md:px-7 md:pt-7">
      <div className="flex items-center gap-2">
        <Link href={"/translate" as Route} aria-label="Back to Translate" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface hover:bg-tint"><ArrowLeft size={20} aria-hidden="true" /></Link>
        <PageHeader eyebrow={tripName} title="Camera" action={<Chip>{fromLang.native} → {toLang.native}</Chip>} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label="View" value={view} onChange={setView} options={[{ value: "overlay", label: "Overlay" }, { value: "text", label: "Text" }]} />
        <span aria-disabled="true" title="Live camera translation is coming in a later round" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 text-[13px] font-bold text-muted">Live <Chip tone="premium">Soon</Chip></span>
      </div>

      <div className={cx("relative overflow-hidden rounded-2xl border border-line bg-map", image ? "aspect-[3/4] max-h-[70dvh] md:aspect-[4/3]" : "flex aspect-[3/4] max-h-[60dvh] items-center justify-center md:aspect-[16/9]")}>
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- object URLs and a static SVG; no optimisation possible or needed */}
            <img src={image.url} alt={image.alt} className="h-full w-full object-contain" />
            {lines && view === "overlay" && (
              <ul aria-labelledby={listId} className="absolute inset-0">
                <li className="sr-only" id={listId}>Translated lines over the photo</li>
                {lines.map((l, i) => l.box && (
                  <motion.li
                    key={i}
                    initial={reduce ? false : { scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, delay: reduce ? 0 : i * 0.04 }}
                    style={{ left: `${l.box[0] * 100}%`, top: `${l.box[1] * 100}%`, maxWidth: `${(1 - l.box[0]) * 100 - 4}%` }}
                    className="absolute flex max-w-full flex-wrap items-center gap-x-2 rounded-lg bg-[#121614]/88 px-2.5 py-1.5 text-[13px] font-bold leading-tight text-[#F1F3EF] shadow-card backdrop-blur-sm"
                  >
                    <span lang={to}>{l.translated || l.original}</span>
                    {l.price != null && <span className="text-[#C9D3CC]">{price(l.price)}</span>}
                    <span className="sr-only">, originally <span lang={from}>{l.original}</span></span>
                  </motion.li>
                ))}
              </ul>
            )}
            {pending && <p role="status" className="absolute inset-x-0 bottom-0 bg-[#121614]/80 px-4 py-2 text-center text-[13px] font-bold text-[#F1F3EF]">Reading the photo…</p>}
          </>
        ) : (
          <div className="flex max-w-[360px] flex-col items-center gap-3 p-6 text-center">
            <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-tint text-primary"><Camera size={26} /></span>
            <p className="text-[16px] font-bold">Point it at a menu, a sign or a receipt</p>
            <p className="text-[13px] text-muted">The photo is read on the server and thrown away. Nothing is stored.</p>
          </div>
        )}
      </div>

      <p role="status" className={status && !pending ? "text-[13px] font-semibold text-primary" : "sr-only"}>{pending ? "" : status}</p>
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</p>}

      <AnimatePresence initial={false}>
        {lines && view === "text" && (
          <motion.section key="text" aria-label="Translated text" initial={reduce ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.2 }} className="card divide-y divide-line">
            {lines.map((l, i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <p lang={to} className="text-[15px] font-bold">{l.translated || l.original}</p>
                  <p lang={from} className="text-[12.5px] text-muted">{l.original}{l.confidence < 0.7 ? " · low confidence" : ""}</p>
                </div>
                {l.price != null && <p className="shrink-0 text-right text-[13px] font-bold">{price(l.price)}</p>}
              </div>
            ))}
          </motion.section>
        )}
      </AnimatePresence>

      <input ref={takeRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={chooseRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Button variant="secondary" icon={<ImageIcon size={18} />} onClick={() => chooseRef.current?.click()}>Choose photo</Button>
        <Button variant="ink" icon={<Camera size={18} />} onClick={() => takeRef.current?.click()}>Take photo</Button>
        <Button variant="secondary" icon={<Sparkles size={18} />} onClick={sample} loading={pending}>Try a sample menu</Button>
        <Button variant="secondary" icon={<Receipt size={18} />} disabled={!lines || !lines.some((l) => l.price != null) || !splitAction || pending} title={canSplit ? undefined : "Split is part of Atlas Premium Pass"} onClick={() => lines && splitAction && start(async () => { const r = await splitAction(lines.filter((l) => l.price != null).map((l) => ({ name: l.translated || l.original, localName: l.original, price: l.price! })), null); if (r && "error" in r) setError(r.error); })}>Send to Split</Button>
      </div>
      {rate?.stale && <p className="text-[12px] text-muted">Prices use a cached rate ({rate.base} → {rate.quote}); you seem to be offline.</p>}
      {!localCurrency && <p className="text-[12px] text-muted">Set the trip&apos;s currency to see prices in {homeCurrency}.</p>}
    </div>
  );
}
