import Link from "next/link";
import { Tile } from "@/components/ui/primitives";

const LEGAL = [["terms", "Terms"], ["privacy", "Privacy"], ["cookies", "Cookies"]] as const;

/** Public pages (claim links, invites): a light shell with the legal footer from the compliance round. No app nav. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="mx-auto flex w-full max-w-[640px] items-center gap-2.5 px-4 pt-5 md:px-0">
        <Tile name="Voya" size={32} radius={9} />
        <span className="text-[15px] font-extrabold tracking-[-0.02em]">Voya</span>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[640px] flex-1 px-4 py-5 md:px-0">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2 px-4 py-6 text-[12px] text-muted md:px-0">
          <nav aria-label="Legal"><ul className="flex flex-wrap gap-x-4 gap-y-1 font-semibold">{LEGAL.map(([slug, label]) => <li key={slug}><Link href={`/legal/${slug}`} className="hover:text-ink">{label}</Link></li>)}</ul></nav>
          <p>Split doesn&apos;t move money. Links expire 30 days after they&apos;re sent and are public to whoever has them. Essential cookies only.</p>
          <p>Voya · Maps © OpenStreetMap contributors · Manrope by Indian Type Foundry</p>
        </div>
      </footer>
    </div>
  );
}
