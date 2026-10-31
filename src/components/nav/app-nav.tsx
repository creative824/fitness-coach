"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, LineChart, MessageCircle, UserRound } from "lucide-react";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

const items = [
  { href: "/today", label: t.nav.today, Icon: Home },
  { href: "/plan", label: t.nav.plan, Icon: CalendarDays },
  { href: "/coach", label: t.nav.coach, Icon: MessageCircle },
  { href: "/progress", label: t.nav.progress, Icon: LineChart },
  { href: "/profile", label: t.nav.profile, Icon: UserRound },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile: fixed bottom bar with five items (spec §4). Hidden from md up. */
export function BottomNav() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label={t.nav.mainLabel}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-brand" : "text-ink-muted"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-accent" : ""
                  }`}
                >
                  <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop / tablet: side rail on the start (right) side. */
export function SideNav() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label={t.nav.mainLabel}
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-e border-line bg-surface px-4 py-6 md:flex"
    >
      <Link href="/today" className="px-3 text-lg font-bold text-brand">
        {t.appName}
      </Link>
      <ul className="flex flex-col gap-1">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-full px-4 font-medium transition-colors ${
                  active ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-canvas"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
