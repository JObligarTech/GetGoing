import { cx } from "@/lib/utils";

/**
 * A phone bezel around a real screenshot of the demo trip. Light and dark captures
 * are swapped by the viewer's colour scheme; the alt text says what the screen shows.
 */
export function PhoneFrame({ shot, alt, className, priority }: { shot: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={cx("group relative aspect-[393/852] w-full max-w-[300px] overflow-hidden rounded-[38px] border-[6px] border-[#1B211C] bg-[#1B211C] shadow-[0_30px_80px_-20px_rgba(0,0,0,.55)]", className)}>
      <span aria-hidden="true" className="absolute top-2 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-[#1B211C]" />
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet={`/marketing/${shot}-dark.jpg`} />
        
        <img src={`/marketing/${shot}-light.jpg`} alt={alt} width={786} height={1704} loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full rounded-[32px] object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
      </picture>
    </div>
  );
}

/** A browser-window frame for the desktop capture. */
export function WindowFrame({ shot, alt, className }: { shot: string; alt: string; className?: string }) {
  return (
    <div className={cx("group overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(0,0,0,.45)]", className)}>
      <div aria-hidden="true" className="flex h-9 items-center gap-1.5 border-b border-line bg-canvas px-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" /><span className="h-2.5 w-2.5 rounded-full bg-line-strong" /><span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 h-5 flex-1 rounded-md bg-surface px-2 text-[11px] leading-5 text-muted">voya.app/navigate/tree</span>
      </div>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet={`/marketing/${shot}-dark.jpg`} />
        
        <img src={`/marketing/${shot}-light.jpg`} alt={alt} width={1920} height={1200} loading="lazy" decoding="async" className="block w-full transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
      </picture>
    </div>
  );
}
