import type { Metadata } from "next";
import { Suspense } from "react";
import { CalorieToggle } from "@/components/food/calorie-toggle";
import { FoodList } from "@/components/food/food-list";
import { FoodLogger } from "@/components/food/food-logger";
import { FoodTotalsLine } from "@/components/food/food-totals";
import { InfoButton } from "@/components/knowledge/info-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { requireUser } from "@/lib/data/user";
import { loadFoodDay } from "@/lib/food/data";
import { mealTypeAt } from "@/lib/food/items";
import { localDay } from "@/lib/water/time";
import { Salad } from "lucide-react";

export const metadata: Metadata = { title: "יומן אוכל" };

export default function FoodPage() {
  return (
    <>
      <PageHeader title="יומן אוכל" subtitle="כותבים במילים פשוטות מה אכלתם. ההערכה היא כיוון, לא מספר מדויק." />
      <Suspense fallback={<LoadingState label="טוען…" />}>
        <Food />
      </Suspense>
    </>
  );
}

async function Food() {
  const user = await requireUser();
  const { date, minutes } = localDay(new Date());
  const day = await loadFoodDay(user.id, date);
  if (!day.available) {
    return (
      <EmptyState
        icon={<Salad aria-hidden="true" />}
        title="יומן האוכל עוד לא הופעל"
        body="צריך להריץ פעם אחת את עדכון מסד הנתונים של יומן האוכל ב-Supabase. אחרי זה הדף יעבוד."
      />
    );
  }
  return (
    <>
      <FoodLogger aiEnabled={Boolean(process.env.GEMINI_API_KEY)} tracking={day.tracking} defaultMeal={mealTypeAt(minutes)} />
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">היום</h2>
          {day.tracking ? <InfoButton topic="calories" /> : null}
        </div>
        {day.tracking ? <FoodTotalsLine totals={day.totals} label="סה״כ מאושר היום" /> : null}
        <FoodList logs={day.logs} tracking={day.tracking} />
      </Card>
      <Card>
        <CalorieToggle on={day.tracking} />
      </Card>
    </>
  );
}
