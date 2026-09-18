import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/utils";

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  hint?: string;
  error?: string | undefined;
  /** For the dark auth panels. */
  onDark?: boolean;
}

/** Labelled input with hint + error wired via aria-describedby / aria-invalid. */
export function Field({ label, hint, error, onDark, className, ...rest }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cx("text-[13px] font-semibold", onDark ? "text-[#C9D3CC]" : "text-ink")}>{label}</label>
      <input
        id={id}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className={cx(
          "h-12 rounded-lg border px-3.5 text-[15px] outline-none transition-[border-color,box-shadow] duration-(--dur-fast)",
          onDark
            ? "border-white/15 bg-white/10 text-[#F1F3EF] placeholder:text-[#98A39C] focus:border-[#7DBA8E]"
            : "border-line-strong bg-surface text-ink placeholder:text-faint focus:border-primary",
          error && "border-danger",
          className,
        )}
        {...rest}
      />
      {hint && <p id={hintId} className={cx("text-[12px]", onDark ? "text-[#98A39C]" : "text-muted")}>{hint}</p>}
      {error && <p id={errId} role="alert" className="text-[12px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

export function Checkbox({ label, description, error, onDark, ...rest }: Omit<ComponentProps<"input">, "type" | "id"> & { label: ReactNode; description?: ReactNode; error?: string | undefined; onDark?: boolean }) {
  const id = useId();
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input id={id} type="checkbox" aria-describedby={errId} aria-invalid={error ? true : undefined} className="mt-0.5 h-5 w-5 shrink-0 accent-[#2F5D3A]" {...rest} />
        <span className={cx("text-[13px] leading-snug", onDark ? "text-[#C9D3CC]" : "text-ink")}>
          {label}
          {description && <span className={cx("block text-[12px]", onDark ? "text-[#98A39C]" : "text-muted")}>{description}</span>}
        </span>
      </label>
      {error && <p id={errId} role="alert" className="pl-8 text-[12px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

/** Form-level error region, announced immediately. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{children}</p>;
}
