"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const items = [
  { href: "/admin", label: t.admin.nav.home },
  { href: "/admin/exercises", label: t.admin.nav.exercises },
  { href: "/admin/meals", label: t.admin.nav.meals },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label={t.screens.admin.title} className="flex gap-2 overflow-x-auto">
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`min-h-11 shrink-0 rounded-full px-4 py-2.5 text-sm font-medium ${
              active ? "bg-brand text-white" : "border border-line bg-surface hover:bg-brand-soft"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
