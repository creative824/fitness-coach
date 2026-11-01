import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EVIDENCE_LABEL, KNOWLEDGE, strongestEvidence } from "@/content/knowledge";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.coach;

export const metadata: Metadata = { title: s.title };

/**
 * Until the coach chat arrives: the knowledge behind the plan, one short card per topic,
 * with the same sources as the "?" buttons. Collapsed, so the screen stays a list of titles.
 */
export default function CoachPage() {
  return (
    <>
      <PageHeader title={s.title} subtitle={s.disclaimer} />
      <Card tone="night" className="flex flex-col gap-2 p-6">
        <h2 className="text-xl font-semibold">הידע שמאחורי התוכנית</h2>
        <p className="leading-relaxed text-white/70">
          כל יעד בתוכנית נשען על הנחיות מקצועיות וסקירות מחקר. כאן אפשר לקרוא למה, מה עדיין לא ודאי, ומאיפה זה בא. שיחה עם המאמן תגיע בהמשך.
        </p>
      </Card>
      <ul className="flex flex-col gap-3">
        {Object.entries(KNOWLEDGE).map(([key, card]) => (
          <li key={key}>
            <Card className="p-0">
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold">{card.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-field px-2.5 py-0.5 text-xs text-ink-muted">
                      {EVIDENCE_LABEL[strongestEvidence(card)]}
                    </span>
                    <span aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <div className="flex flex-col gap-3 px-5 pb-5">
                  <p className="text-sm leading-relaxed">{card.body}</p>
                  <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed">{card.general}</p>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    <span className="font-semibold">מה עדיין לא ודאי: </span>
                    {card.uncertain}
                  </p>
                  <ul className="flex flex-col gap-2 border-t border-line pt-3">
                    {card.sources.map((src) => (
                      <li key={src.url} className="text-xs">
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 hover:underline">
                          <ExternalLink aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                          <span className="flex flex-col">
                            <span dir="ltr" className="text-start">
                              {src.title}
                            </span>
                            <span className="text-ink-muted">
                              {EVIDENCE_LABEL[src.kind]} · <bdi>{src.publisher}</bdi>
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
