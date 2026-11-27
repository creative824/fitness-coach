import { Lightbulb, Plus, Utensils } from "lucide-react";
import Link from "next/link";

const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");

/**
 * The food on the home screen: what was eaten today and the same two actions as the diary.
 * No menu: nothing appears here that the user did not add.
 */
export function HomeFood({ meals, kcal, protein, target, showNumbers }: { meals: number; kcal: number; protein: number; target: number | null; showNumbers: boolean }) {
  return (
    <section aria-labelledby="home-food" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <Link href="/progress?r=day" className="flex items-center justify-between gap-2 rounded-lg">
        <h2 id="home-food" className="flex items-center gap-1.5 font-semibold">
          <Utensils aria-hidden="true" className="size-4" />
          יום האוכל שלי
        </h2>
        <span className="text-sm text-ink-muted">
          {meals ? (
            showNumbers ? (
              <>
                <span className="num font-semibold text-ink">{fmt(kcal)}</span>
                {target ? (
                  <>
                    {" "}
                    מתוך <span className="num">{fmt(target)}</span>
                  </>
                ) : null}{" "}
                קל׳ · <span className="num">{fmt(protein)}</span> ג׳ חלבון
              </>
            ) : (
              <>
                <span className="num">{meals}</span> מנות היום
              </>
            )
          ) : (
            "עדיין לא הוספת מנות להיום"
          )}
        </span>
      </Link>
      <Link
        href="/progress?r=day&open=add"
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white hover:bg-brand-strong active:scale-[0.98]"
      >
        <Plus aria-hidden="true" className="size-6" strokeWidth={2.75} />
        הוספת מנה
      </Link>
      <Link
        href="/progress?r=day&open=idea"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-field font-medium hover:bg-line/70 active:scale-[0.98]"
      >
        <Lightbulb aria-hidden="true" className="size-5 text-warning" />
        תן לי רעיון למנה
      </Link>
    </section>
  );
}
