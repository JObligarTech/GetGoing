"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tile } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";
import { DESKTOP_NAV, PHONE_NAV, isActive } from "./nav";

export interface ShellUser { name: string; tripName: string | null }

/**
 * Responsive shell:
 *  < md  : bottom tab bar (phone)
 *  md–lg : icon rail (iPad)
 *  ≥ lg  : 220px sidebar with labels + Premium badges (desktop)
 * One <nav> per breakpoint; only the visible one is in the accessibility tree.
 */
export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh">
      {/* Sidebar / rail */}
      <nav aria-label="Main" className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-line bg-surface p-3.5 md:flex md:w-[72px] lg:w-[220px] lg:px-3.5 lg:py-5.5">
        <Link href="/home" className="mb-5 flex items-center gap-2.5 rounded-lg px-2.5 py-1 md:justify-center lg:justify-start" aria-label="Voya home">
          <Tile name="Voya" size={32} radius={9} />
          <span className="hidden text-[17px] font-extrabold tracking-[-0.02em] lg:inline">Voya</span>
        </Link>
        {DESKTOP_NAV.map(({ href, label, Icon, premium }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={premium ? `${label}, Premium` : undefined}
              title={label}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors duration-(--dur-fast) md:justify-center lg:justify-start",
                active ? "bg-tint font-bold text-on-tint" : "font-semibold text-muted hover:bg-tint/60 hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.2 : 1.9} />
              <span className="hidden flex-1 lg:inline">{label}</span>
              {premium && <span aria-hidden="true" className="hidden rounded-sm bg-premium-bg px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-premium-text lg:inline">Premium</span>}
            </Link>
          );
        })}
        <div className="mt-auto flex items-center gap-2.5 rounded-lg bg-canvas p-3 md:justify-center lg:justify-start">
          <Tile name={user.name} size={36} radius={999} className="border-2 border-surface" />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-[13px] font-bold">{user.name}</p>
            <p className="truncate text-[11.5px] text-muted">
              {user.tripName ?? "No trip yet"} · <Link href="/trips" className="font-bold text-primary">Switch</Link>
            </p>
          </div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" tabIndex={-1} className="flex-1 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      {/* Phone tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid h-[calc(84px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-surface px-2 pt-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {PHONE_NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href, "phone");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx("flex flex-col items-center gap-[3px] rounded-md pt-1 text-[10.5px]", active ? "font-bold text-primary" : "font-semibold text-muted")}
            >
              <Icon aria-hidden="true" size={24} strokeWidth={active ? 2.1 : 1.9} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
