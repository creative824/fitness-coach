"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, Home, LineChart, MessageCircle, Trophy, UserRound } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

const items = [
  { href: "/today", label: t.nav.today, Icon: Home },
  { href: "/plan", label: t.nav.plan, Icon: CalendarDays },
  { href: "/coach", label: t.nav.coach, Icon: MessageCircle },
  { href: "/progress", label: t.nav.progress, Icon: LineChart },
  { href: "/competitions", label: t.nav.competitions, Icon: Trophy },
] as const;

type IsActive = (href: string) => boolean;
const none: IsActive = () => false;

/**
 * The path is request data: on a dynamic route (/competitions/[id]) it must be read inside
 * Suspense. The fallback is the same nav with nothing highlighted.
 */
function withPath(View: (p: { isActive: IsActive }) => React.ReactNode) {
  function Live() {
    const pathname = usePathname();
    return <View isActive={(href) => pathname === href || pathname.startsWith(`${href}/`)} />;
  }
  return function Nav() {
    return (
      <Suspense fallback={<View isActive={none} />}>
        <Live />
      </Suspense>
    );
  };
}

/** Mobile: a slim top row with the logo and the way to the profile, which left the bottom bar. */
export const TopBar = withPath(function TopBarView({ isActive }) {
  const active = isActive("/profile");
  return (
    <div className="flex items-center justify-between md:hidden">
      <Logo href="/today" />
      <Link
        href="/profile"
        aria-label={t.nav.profile}
        aria-current={active ? "page" : undefined}
        className={`flex size-10 items-center justify-center rounded-full ring-1 transition-colors ${
          active ? "bg-night text-accent ring-night" : "bg-white/70 text-ink ring-white hover:bg-white"
        }`}
      >
        <UserRound aria-hidden="true" className="size-5" />
      </Link>
    </div>
  );
});

/**
 * Mobile: a floating graphite pill (spec §4: five items). The active item opens into a lime
 * capsule with its label; the others are icons with accessible names. Hidden from md up.
 */
export const BottomNav = withPath(function BottomNavView({ isActive }) {
  return (
    <nav
      aria-label={t.nav.mainLabel}
      className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-2xl bg-night/95 p-1.5 shadow-[var(--shadow-float)] ring-1 ring-white/5 backdrop-blur-xl">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className={active ? "flex-[1.6]" : "flex-1"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  active ? "bg-accent px-3 text-ink" : "text-white/60 hover:text-white"
                }`}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                {active ? <span className="truncate">{label}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

/** Desktop / tablet: a floating rail on the start (right) side. */
export const SideNav = withPath(function SideNavView({ isActive }) {
  return (
    <div className="sticky top-0 hidden h-dvh shrink-0 p-4 md:block">
      <nav
        aria-label={t.nav.mainLabel}
        className="flex h-full w-60 flex-col gap-8 rounded-2xl bg-white/70 px-3 py-6 shadow-[var(--shadow-card)] ring-1 ring-white backdrop-blur-xl"
      >
        <div className="px-3">
          <Logo href="/today" />
        </div>
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-4 font-medium transition-colors ${
                    active ? "bg-night text-white" : "text-ink-muted hover:bg-white hover:text-ink"
                  }`}
                >
                  <Icon aria-hidden="true" className={`size-5 ${active ? "text-accent" : ""}`} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/profile"
          aria-current={isActive("/profile") ? "page" : undefined}
          className={`mt-auto flex min-h-11 items-center gap-3 rounded-xl px-4 font-medium transition-colors ${
            isActive("/profile") ? "bg-night text-white" : "text-ink-muted hover:bg-white hover:text-ink"
          }`}
        >
          <UserRound aria-hidden="true" className="size-5" />
          {t.nav.profile}
        </Link>
      </nav>
    </div>
  );
});
