import { BottomNav, SideNav } from "@/components/nav/app-nav";

/**
 * Personal area shell: floating side rail on desktop, floating pill bar on mobile.
 * The auth guard lives in the proxy and in each page's requireUser().
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className="flex-1 px-4 pb-32 pt-5 md:px-10 md:pb-10 md:pt-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
