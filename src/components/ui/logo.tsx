import Link from "next/link";

/**
 * Brand mark: an italic "T" built from two blades, lime flowing into teal.
 * Gradient ids are fixed; repeated marks on a page share identical definitions.
 */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tr-blade-a" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#b4f53c" />
          <stop offset="1" stopColor="#14c4b4" />
        </linearGradient>
        <linearGradient id="tr-blade-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0fae9c" />
          <stop offset="1" stopColor="#8ef03c" />
        </linearGradient>
      </defs>
      <path
        d="M8 46 L18 25 C22 17 29 14 39 14 L95 12 L90 23 C85 34 77 38 66 38 L41 39 C34 39 30 41 27 46 Z"
        fill="url(#tr-blade-a)"
      />
      <path d="M76 40 L60 77 C57 83 52 86 46 88 L30 94 L45 60 C50 48 57 41 67 40 Z" fill="url(#tr-blade-b)" />
    </svg>
  );
}

/** Wordmark "trAIning" with the AI picked out in brand green. */
export function Wordmark({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span
      dir="ltr"
      className={`font-[family-name:var(--font-num)] font-extrabold tracking-[-0.04em] italic ${
        tone === "dark" ? "text-white" : "text-ink"
      } ${className}`}
    >
      tr
      <span className="bg-gradient-to-br from-[#8ef03c] to-[#14b8a6] bg-clip-text pe-[0.04em] text-transparent">AI</span>
      ning
    </span>
  );
}

export function Logo({ href = "/", tone = "light" }: { href?: string; tone?: "light" | "dark" }) {
  return (
    <Link href={href} aria-label="trAIning" className="inline-flex items-center gap-2 rounded-xl text-[1.35rem] leading-none">
      <LogoMark className="size-8" />
      <Wordmark tone={tone} />
    </Link>
  );
}
