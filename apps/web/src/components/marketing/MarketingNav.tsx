"use client";
import { useState } from "react";
import Link from "next/link";
import { useMotionValueEvent, useScroll } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Tile } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";

const LINKS = [
  { href: "#context", label: "How it works" },
  { href: "#navigate", label: "Navigate" },
  { href: "#trees", label: "Tree routes" },
  { href: "#roadmap", label: "What's next" },
];

/** Sits transparent over the dark hero, gains a surface once the page scrolls. */
export function MarketingNav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 40));
  return (
    <header className={cx("fixed inset-x-0 top-0 z-30 transition-colors duration-(--dur-base)", solid ? "border-b border-line bg-surface/90 text-ink backdrop-blur-md" : "text-[#F1F3EF]")}>
      <nav aria-label="Site" className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-7">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Voya home">
          <Tile name="Voya" size={32} radius={9} />
          <span className="text-[17px] font-extrabold tracking-[-0.02em]">Voya</span>
        </Link>
        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}><a href={l.href} className={cx("rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors", solid ? "text-muted hover:bg-tint hover:text-ink" : "text-[#C9D3CC] hover:bg-white/10 hover:text-white")}>{l.label}</a></li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Button href="/login" variant={solid ? "ghost" : "translucent"} size="sm">Log in</Button>
          <Button href="/signup" variant={solid ? "primary" : "light"} size="sm">Get started</Button>
        </div>
      </nav>
    </header>
  );
}
