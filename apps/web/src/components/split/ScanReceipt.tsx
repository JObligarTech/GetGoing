"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Camera, ImageIcon, PenLine, Plus, Sparkles } from "lucide-react";
import { formatMoney, type BillInput } from "@voya/core";
import type { ScannedReceipt } from "@/app/(app)/split/actions";
import { Button } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/primitives";
import { Avatars } from "@/components/navigate/tree/Avatars";

export interface ScanReceiptProps {
  tripId: string;
  merchant: string | null;
  placeId: string | null;
  currency: string;
  people: { id: string; name: string; color: string; homeCurrency: string | null }[];
  manual: boolean;
  scanAction: (fd: FormData) => Promise<ScannedReceipt | { error: string }>;
  saveAction: (input: unknown) => Promise<{ billId: string } | { error: string }>;
}

/**
 * Scan (mockup 5a): merchant and currency come from the trip, the travelers are already the
 * people. Photos go to the OCR provider and are dropped; the parsed lines become a draft bill.
 */
export function ScanReceipt({ tripId, merchant, placeId, currency, people, manual, scanAction, saveAction }: ScanReceiptProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const snapRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  const create = (scanned: ScannedReceipt | null) => start(async () => {
    const bill: BillInput = {
      billId: null, tripId, placeId, merchant: scanned?.merchant && !merchant ? scanned.merchant : merchant ?? scanned?.merchant ?? "Receipt", currency, status: "draft", billDate: null,
      taxAmount: scanned?.tax ?? 0, taxLabel: scanned?.taxLabel ?? null, serviceAmount: scanned?.service ?? 0, discountAmount: 0, roundingUnit: currency === "JPY" || currency === "KRW" ? 1 : 0.01, taxMode: "proportional",
      paidBy: people[0]?.id ?? null,
      items: (scanned?.items ?? []).map((i, n) => ({ id: `i${n}`, name: i.name, localName: i.localName, qty: i.qty, unitPrice: i.unitPrice, confidence: i.confidence })),
      participants: people.map((p) => ({ id: p.id, travelerId: p.id, name: p.name, color: p.color, homeCurrency: p.homeCurrency })),
      shares: [],
    };
    if (!bill.items.length) bill.items = [{ id: "i0", name: "Item", localName: null, qty: 1, unitPrice: 0, confidence: null }];
    const r = await saveAction(bill);
    if ("error" in r) { setError(r.error); return; }
    router.push(`/split/${r.billId}${scanned ? "" : "?manual=1"}` as Route);
  });
  const scan = (list: File[], sample = false) => {
    const fd = new FormData();
    fd.set("tripId", tripId);
    if (sample) fd.set("sample", "1");
    for (const f of list) fd.append("image", f);
    setError(null); setStatus("Reading the receipt…");
    start(async () => {
      const r = await scanAction(fd);
      if ("error" in r) { setError(r.error); setStatus(""); return; }
      setStatus(`Read ${r.items.length} lines${r.flagged ? `, ${r.flagged} uncertain` : ""}. Opening the bill…`);
      create(r);
    });
  };
  const onFiles = (fl: FileList | null) => { const list = [...(fl ?? [])]; if (!list.length) return; setFiles((f) => [...f, ...list].slice(0, 10)); };

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wide text-muted">Merchant</p>
            <p className="truncate text-[17px] font-extrabold">{merchant ?? "From the receipt"}</p>
            {merchant && <p className="text-[12px] text-muted">tonight&apos;s dinner · from your plan</p>}
          </div>
          <Chip>Currency {currency}</Chip>
        </div>
        <div className="flex items-center gap-3">
          <Avatars travelers={people} size={28} />
          <p className="text-[13px] font-semibold text-muted">{people.length} people from your trip</p>
        </div>
      </Card>

      {!manual && (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-map p-6 text-center">
          <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-tint text-primary"><Camera size={26} /></span>
          <p className="text-[16px] font-bold">{files.length ? `${files.length} page${files.length > 1 ? "s" : ""} ready` : "Receipt detected · hold steady"}</p>
          <p className="text-[13px] text-muted">Items, tax and tip are read from the photo. The photo is read once and never stored.</p>
          {files.length > 0 && <ul className="text-[12px] text-muted">{files.map((f, i) => <li key={i}>Page {i + 1}: {f.name}</li>)}</ul>}
        </div>
      )}
      <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</p>}

      <input ref={snapRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <input ref={pickRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      {manual ? (
        <Button size="cta" full icon={<PenLine size={18} />} onClick={() => create(null)} loading={pending}>Start with an empty bill</Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button variant="secondary" icon={<ImageIcon size={18} />} onClick={() => pickRef.current?.click()}>Choose photo</Button>
          <Button variant="ink" icon={<Camera size={18} />} onClick={() => snapRef.current?.click()}>Snap</Button>
          <Button variant="secondary" icon={<Plus size={18} />} onClick={() => snapRef.current?.click()} disabled={!files.length}>Add another page</Button>
          <Button variant="secondary" icon={<Sparkles size={18} />} onClick={() => scan([], true)} loading={pending}>Try a sample receipt</Button>
        </div>
      )}
      {!manual && files.length > 0 && <Button size="cta" full onClick={() => scan(files)} loading={pending}>Read {files.length > 1 ? `${files.length} pages` : "the receipt"}</Button>}
      {!manual && <Button variant="ghost" size="sm" icon={<PenLine size={16} />} onClick={() => create(null)} disabled={pending}>Enter by hand instead</Button>}
      <p className="text-[12px] text-muted">Totals will show in {currency}{people.some((p) => p.homeCurrency && p.homeCurrency !== currency) ? ` and each person's home currency (${[...new Set(people.map((p) => p.homeCurrency).filter((c): c is string => !!c && c !== currency))].join(", ")})` : ""}. Example: {formatMoney(1200, currency)} ramen.</p>
    </div>
  );
}
