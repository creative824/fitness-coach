import type { Metadata } from "next";
import { DemoDay } from "@/components/demo/demo-day";

export const metadata: Metadata = { title: "ניסיון בלי הרשמה", robots: { index: false } };

/** The today screen with sample people, no account and nothing saved. */
export default function DemoPage() {
  return (
    <main className="min-w-0 px-4 pb-24 pt-5">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <DemoDay />
      </div>
    </main>
  );
}
