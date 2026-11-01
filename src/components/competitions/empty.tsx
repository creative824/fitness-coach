import { KeyRound, Plus, Trophy } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** The two main actions (spec §2): create a table, or join one with a code. */
export function CompetitionActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ButtonLink href="/competitions/new">
        <Plus aria-hidden="true" className="size-4" />
        צור לעצמך טבלת מנצחים אישית
      </ButtonLink>
      <ButtonLink href="/competitions/join" variant="secondary" className="py-2.5 text-center">
        <KeyRound aria-hidden="true" className="size-4" />
        הכנס קוד או הצטרף לטבלת מנצחים קיימת
      </ButtonLink>
    </div>
  );
}

export function NoCompetitions() {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-xl bg-night text-accent shadow-[var(--shadow-float)]">
        <Trophy aria-hidden="true" className="size-7" />
      </div>
      <h2 className="text-xl font-semibold">עוד אין לך תחרויות</h2>
      <p className="max-w-sm leading-relaxed text-ink-muted">
        עד 20 משתתפים בכל טבלה. כל אחד מתחרה מול התוכנית האישית שלו, כך שמתחיל ומתקדם מתחרים בהוגנות.
      </p>
      <div className="mt-2 w-full">
        <CompetitionActions />
      </div>
    </Card>
  );
}
