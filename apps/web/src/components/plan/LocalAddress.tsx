"use client";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

/**
 * "Show address in 日本語" — the taxi card. Expands to a large-type panel you can
 * hold up to a driver. Disclosure pattern: button + aria-expanded + region.
 */
export function LocalAddress({ label, lang, name, address, icon }: { label: string; lang?: string; name: string; address: string; icon: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-tint/60">
        {icon}
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        <ChevronDown aria-hidden="true" size={18} className={`text-faint transition-transform duration-(--dur-base) ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            role="region"
            aria-label={label}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="m-2 rounded-xl bg-button-ink p-5 text-on-button-ink" lang={lang}>
              <p className="text-[22px] leading-snug font-extrabold">{name}</p>
              <p className="mt-2 text-[20px] leading-snug font-semibold">{address}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
