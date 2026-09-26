"use client";
import { useState } from "react";
import { Maximize2, Minimize2, Phone } from "lucide-react";
import { languageByCode, type DriverCard } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/utils";
import { SpeakButton } from "./shared";

/** The dark "Show to driver" card: hold the phone up; Enlarge makes the type bigger. */
export function DriverCardView({ card }: { card: DriverCard }) {
  const [big, setBig] = useState(false);
  const lang = languageByCode(card.lang)!;
  const spoken = [card.headline, card.name, card.address].filter(Boolean).join("。 ");
  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Card for the driver" className={cx("flex flex-col gap-4 rounded-3xl bg-[#121614] p-6 text-[#F1F3EF] shadow-card", big && "min-h-[70dvh] justify-center p-8")}>
        <div lang={card.lang} dir={lang.rtl ? "rtl" : undefined} className="flex flex-col gap-3">
          <p className={cx("font-bold text-[#C9D3CC]", big ? "text-[30px]" : "text-[22px]")}>{card.headline}</p>
          {card.romanized && <p className="text-[14px] text-[#98A39C]">{card.romanized}</p>}
          <p className={cx("leading-tight font-extrabold tracking-[-0.01em] text-balance", big ? "text-[48px]" : "text-[34px]")}>{card.name}</p>
          {card.address && <p className={cx("leading-snug font-semibold", big ? "text-[32px]" : "text-[24px]")}>{card.address}</p>}
          {card.phone && <a href={`tel:${card.phone}`} className={cx("inline-flex items-center gap-2 font-bold text-[#F1F3EF] underline decoration-[#98A39C] underline-offset-4", big ? "text-[28px]" : "text-[22px]")}><Phone size={big ? 24 : 18} aria-hidden="true" />{card.phone}</a>}
        </div>
        {card.hasLocal && (
          <div lang="en" className="border-t border-white/15 pt-3 text-[14px] text-[#C9D3CC]">
            <p className="font-bold text-[#F1F3EF]">{card.english.name}</p>
            {card.english.address && <p>{card.english.address}</p>}
          </div>
        )}
        {!card.hasLocal && <p role="note" className="text-[13px] text-[#C9D3CC]">This place has no {lang.name} name or address saved yet, so the English one is shown.</p>}
      </section>
      <div className="flex flex-wrap gap-2">
        <SpeakButton text={spoken} lang={lang.speech} label="Speak" variant="ink" size="md" />
        <Button variant="secondary" icon={big ? <Minimize2 size={18} /> : <Maximize2 size={18} />} aria-pressed={big} onClick={() => setBig((b) => !b)}>{big ? "Smaller" : "Enlarge"}</Button>
      </div>
    </div>
  );
}
