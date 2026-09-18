import { cx } from "@/lib/utils";

/** Standard page padding: 16px gutter on phones, 28px on larger screens; max width for readability. */
export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cx("mx-auto flex w-full flex-col gap-3.5 px-4 pt-4 pb-6 md:px-7 md:pt-7", wide ? "max-w-[1400px]" : "max-w-[720px]", className)}>{children}</div>;
}
