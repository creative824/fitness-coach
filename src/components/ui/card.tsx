import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(23,33,27,0.04)] ${className}`}
      {...props}
    />
  );
}
