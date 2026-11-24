import type { Metadata } from "next";
import { Suspense } from "react";
import { FoodList } from "@/components/food/food-list";
import { FoodLogger } from "@/components/food/food-logger";
import { loadSavedFoods } from "@/lib/food/saved-data";
import { CalorieRing } from "@/components/home/calorie-ring";
import { InfoButton } from "@/components/knowledge/info-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { loadDayContext } from "@/lib/day/context";
import { requireUser } from "@/lib/data/user";
import { loadFoodDay } from "@/lib/food/data";
import { mealTypeAt } from "@/lib/food/items";
import { localDay } from "@/lib/water/time";
import { Salad } from "lucide-react";

export const metadata: Metadata = { title: "יומן אוכל" };

export default function FoodPage() {
  return (
    <>
      <PageHeader title="יומן אוכל" subtitle="כותבים במילים פשוטות מה אכלתם, והקלוריות מחושבות מיד." />
      <Suspense fallback={<LoadingState label="טוען…" />}>
        <Food />
      </Suspense>
    </>
  );
}

async function Food() {
  const user = await requireUser();
  const { date, minutes } = localDay(new Date());
  const [day, ctx, savedFoods] = await Promise.all([loadFoodDay(user.id, date), loadDayContext(user.id), loadSavedFoods(user.id).catch(() => [])]);
  if (!day.available) {
    return (
      <EmptyState
        icon={<Salad aria-hidden="true" />}
        title="יומן האוכל עוד לא הופעל"
        body="צריך להריץ פעם אחת את עדכון מסד הנתונים של יומן האוכל ב-Supabase. אחרי זה הדף יעבוד."
      />
    );
  }
  const numbers = ctx.showNumbers;
  const eaten = day.totals.kcal ? Math.round((day.totals.kcal[0] + day.totals.kcal[1]) / 2) : 0;
  return (
    <>
      {numbers && ctx.target ? (
        <section aria-label="היום" className="flex items-center gap-4 rounded-[var(--radius-card)] bg-night p-4 text-white shadow-[var(--shadow-float)]">
          <CalorieRing eaten={eaten} target={ctx.target} size={104} />
          <dl className="grid flex-1 grid-cols-3 gap-2 text-center">
            {(
              [
                ["חלבון", day.totals.protein],
                ["פחמימות", day.totals.carbs],
                ["שומן", day.totals.fat],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-white/60">{k}</dt>
                <dd className="num text-lg font-semibold">{v ?? "–"}</dd>
                <dd className="text-[10px] text-white/50">גרם</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <FoodLogger aiEnabled={Boolean(process.env.GEMINI_API_KEY)} tracking={numbers} defaultMeal={mealTypeAt(minutes)} savedFoods={savedFoods} />
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">מה נאכל היום</h2>
          {numbers ? <InfoButton topic="calories" /> : null}
        </div>
        <FoodList logs={day.logs} tracking={numbers} />
      </Card>
    </>
  );
}
