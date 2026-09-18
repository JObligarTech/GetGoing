"use client";
import Link from "next/link";
import type { Route } from "next";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cx } from "@/lib/utils";

export type ButtonVariant = "primary" | "ink" | "secondary" | "ghost" | "translucent" | "light" | "danger";
export type ButtonSize = "cta" | "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  ink: "bg-button-ink text-on-button-ink hover:opacity-90",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-tint",
  ghost: "bg-transparent text-primary hover:bg-tint",
  // Over the dark world-map hero (auth screens); colours are fixed regardless of theme.
  translucent: "bg-white/10 text-[#F1F3EF] hover:bg-white/15",
  light: "bg-[#F1F3EF] text-[#121614] hover:bg-white",
  danger: "bg-transparent text-danger border border-line-strong hover:bg-danger/10",
};
const SIZE: Record<ButtonSize, string> = {
  cta: "h-13 min-h-13 rounded-xl px-5 text-[15px]",
  md: "h-11 min-h-11 rounded-lg px-4 text-[14px]",
  sm: "h-10 min-h-10 rounded-lg px-3.5 text-[13px]",
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  href?: string;
  icon?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Press feedback is a 3% scale (tokens.motion.pressScale), disabled under
 * prefers-reduced-motion. Minimum height is 44px in every size (touch target).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", full, href, icon, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const classes = cx(
    "relative inline-flex select-none items-center justify-center gap-2 font-bold whitespace-nowrap transition-colors duration-(--dur-fast)",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANT[variant], SIZE[size], full && "w-full", className,
  );
  const tap = reduce ? undefined : { scale: 0.97 };
  const content = (
    <>
      {icon && <span aria-hidden="true" className="inline-flex shrink-0">{icon}</span>}
      <span className={cx(loading && "invisible")}>{children}</span>
      {loading && (
        <span role="status" aria-label="Loading" className="absolute inset-0 flex items-center justify-center">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
    </>
  );
  if (href) {
    // Button-only attributes don't belong on an anchor; everything else (aria-*, title, id, onClick) carries over.
    const { type: _t, disabled: _d, form: _f, formAction: _fa, name: _n, value: _v, ...linkRest } = rest as Record<string, unknown>;
    void _t; void _d; void _f; void _fa; void _n; void _v;
    return (
      <motion.span whileTap={tap} className={cx("inline-flex", full && "w-full")}>
        <Link href={href as Route} className={classes} aria-disabled={disabled || undefined} {...(linkRest as object)}>{content}</Link>
      </motion.span>
    );
  }
  return (
    <motion.button ref={ref} type={type} whileTap={tap} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...(rest as object)}>
      {content}
    </motion.button>
  );
});
