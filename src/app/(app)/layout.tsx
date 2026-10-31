import { BottomNav, SideNav } from "@/components/nav/app-nav";

/**
 * Personal area shell: side rail on desktop, bottom bar on mobile.
 * Auth guard is added in phase 1 (Supabase); for now the screens are empty shells.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className="flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
