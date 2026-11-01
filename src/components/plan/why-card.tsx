import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { WhyLine } from "@/lib/plan/why";

/** "Why we built this plan for you" (follow-up spec §3): the reason and the decision, side by side. */
export function WhyCard({ lines, compact = false }: { lines: WhyLine[]; compact?: boolean }) {
  if (!lines.length) return null;
  return (
    <Card className="flex flex-col gap-3">
      <h2 className={`flex items-center gap-2 font-semibold ${compact ? "text-base" : "text-lg"}`}>
        <Sparkles aria-hidden="true" className="size-5 text-accent-strong" />
        למה בנינו לך את התוכנית הזאת
      </h2>
      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <li key={l.because} className="flex flex-col gap-0.5 border-s-2 border-accent ps-3">
            <span className="text-sm text-ink-muted">{l.because}</span>
            <span className="text-sm font-medium leading-snug">{l.decision}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
