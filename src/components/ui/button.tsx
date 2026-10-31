import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost";

const base =
  "group/btn inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-6 text-base font-medium transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  /** Graphite pill: the main action on light backgrounds. */
  primary: "bg-brand text-white shadow-[0_8px_20px_-10px_rgba(18,21,19,0.6)] hover:bg-brand-strong",
  /** Lime pill: the main action on dark panels, or a single hero call to action. */
  accent: "bg-accent text-ink shadow-[var(--shadow-lime)] hover:brightness-95",
  secondary: "bg-surface text-ink ring-1 ring-line hover:bg-field",
  ghost: "text-ink hover:bg-brand-soft",
};

export function buttonClasses(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
