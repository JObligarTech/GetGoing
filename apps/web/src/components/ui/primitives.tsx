import Link from "next/link";
import type { Route } from "next";
import type { ComponentProps, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { initial } from "@voya/core";
import { cx } from "@/lib/utils";

/** White surface with hairline border, 14px corners — the mockups' base container. */
export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("card", className)} {...rest} />;
}

export function Eyebrow({ className, ...rest }: ComponentProps<"h2">) {
  return <h2 className={cx("text-eyebrow", className)} {...rest} />;
}

/** Section header row: eyebrow left, optional action right. */
export function SectionHeader({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <Eyebrow id={id}>{title}</Eyebrow>
      {action}
    </div>
  );
}

/** Coloured category dot (10px). Decorative; the row text carries the category name. */
export function Dot({ color, size = 10, className }: { color: string; size?: number; className?: string }) {
  return <span aria-hidden="true" className={cx("inline-block shrink-0 rounded-full", className)} style={{ width: size, height: size, background: color }} />;
}

/** Lettered tile — "J" for Japan 2027. Decorative when the name is rendered alongside. */
export function Tile({ name, color, size = 52, radius = 12, invert, className }: { name: string; color?: string; size?: number; radius?: number; invert?: boolean; className?: string }) {
  const fontSize = Math.round(size * 0.42);
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center font-extrabold", className)}
      style={{
        width: size, height: size, borderRadius: radius, fontSize,
        background: invert ? "var(--c-surface-tint)" : color ?? "var(--c-primary)",
        color: invert ? "var(--c-on-tint)" : "#fff",
      }}
    >
      {initial(name)}
    </span>
  );
}

/** Small tinted status chip (26px): "12 days away", "4 travelers", "Past". */
export function Chip({ tone = "tint", className, ...rest }: ComponentProps<"span"> & { tone?: "tint" | "plain" | "premium" | "ink" }) {
  const tones = {
    tint: "bg-tint text-on-tint",
    plain: "text-muted",
    premium: "bg-premium-bg text-premium-text",
    ink: "bg-button-ink text-on-button-ink",
  };
  return <span className={cx("inline-flex h-[26px] items-center whitespace-nowrap rounded-sm px-2.5 text-[11.5px] font-bold", tones[tone], className)} {...rest} />;
}

/** Tinted square with an icon — used for tool cards and the hotel row. */
export function IconCoin({ children, size = 40, className }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("inline-flex shrink-0 items-center justify-center rounded-md bg-tint text-primary", className)} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

export interface ListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  chevron?: boolean;
  className?: string;
  /** Accessible name override when the visible title isn't enough. */
  ariaLabel?: string;
}

/**
 * The list row every screen uses. Renders as a link, a button, or a static div.
 * Rows are separated by a hairline via `divide-y` on the parent Card.
 */
export function ListRow({ leading, title, subtitle, trailing, href, onClick, active, chevron, className, ariaLabel }: ListRowProps) {
  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        {subtitle && <span className="block truncate text-[12px] text-muted">{subtitle}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-faint" />}
    </>
  );
  const classes = cx(
    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-(--dur-fast)",
    active ? "bg-tint" : (href || onClick) && "hover:bg-tint/60",
    className,
  );
  if (href) return <Link href={href as Route} className={classes} aria-label={ariaLabel} aria-current={active ? "true" : undefined}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={classes} aria-label={ariaLabel} aria-pressed={active}>{inner}</button>;
  return <div className={classes}>{inner}</div>;
}

/** Page title block: eyebrow line above a 26px extrabold heading, action on the right. */
export function PageHeader({ eyebrow, title, action, as: Tag = "h1" }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode; as?: "h1" | "h2" }) {
  return (
    <header className="flex min-h-11 items-center justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[13px] font-medium text-muted">{eyebrow}</p>}
        <Tag className="truncate text-[26px] font-extrabold tracking-[-0.02em]">{title}</Tag>
      </div>
      {action}
    </header>
  );
}

/** Round 44px icon button (bell, plus). */
export function IconButton({ label, className, tone = "surface", ...rest }: ComponentProps<"button"> & { label: string; tone?: "surface" | "ink" }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-(--dur-fast)",
        tone === "ink" ? "bg-button-ink text-on-button-ink" : "border border-line-strong bg-surface text-ink hover:bg-tint",
        className,
      )}
      {...rest}
    />
  );
}

/** Green hint bar: "Tap the open slot to pick from 2 saved places nearby." */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("rounded-lg bg-tint px-3.5 py-3 text-[13px] font-semibold leading-snug text-on-tint", className)}>{children}</p>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-[16px] font-bold">{title}</p>
      {body && <p className="max-w-sm text-[13px] text-muted">{body}</p>}
      {action}
    </div>
  );
}
