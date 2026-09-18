import Link from "next/link";
import { Tile } from "@/components/ui/primitives";

const LEGAL = [["terms", "Terms"], ["privacy", "Privacy"], ["refunds", "Refunds"], ["cookies", "Cookies"], ["licences", "Licences"]] as const;

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-7">
        <div className="flex items-center gap-2.5">
          <Tile name="Voya" size={32} radius={9} />
          <div><p className="text-[15px] font-extrabold tracking-[-0.02em]">Voya</p><p className="text-[12px] text-muted">Your whole trip. One place.</p></div>
        </div>
        <nav aria-label="Legal">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-muted">
            {LEGAL.map(([slug, label]) => <li key={slug}><Link href={`/legal/${slug}`} className="hover:text-ink">{label}</Link></li>)}
          </ul>
        </nav>
        <p className="text-[12px] text-muted">Maps © OpenStreetMap contributors</p>
      </div>
    </footer>
  );
}
