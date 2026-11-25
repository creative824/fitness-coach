import type { Metadata } from "next";
import { ArrowLeft, ClipboardList, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FaceAvatar } from "@/components/ui/face-avatar";
import type { AvatarConfig } from "@/lib/avatar";
import { CompetitionsStrip } from "@/components/home/competitions-strip";
import { DayProvider } from "@/components/home/day-context";
import { FitnessCard, type SmallTask } from "@/components/home/fitness-card";
import { TodayWorkout } from "@/components/workout/today-workout";
import { MenuCard } from "@/components/home/menu-card";
import { DaySummary } from "@/components/home/day-summary";
import { DayExtras } from "@/components/home/day-extras";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { competitionCards } from "@/lib/competitions/data";
import { loadDayContext } from "@/lib/day/context";
import { loadScores } from "@/lib/day/score-data";
import { minutesFor, smartTasks, tasksByIds, type SmartTaskInput, type SmartTaskKind } from "@/lib/day/smart-tasks";
import { requireUser } from "@/lib/data/user";
import { loadFoodDay } from "@/lib/food/data";
import { loadSavedFoods } from "@/lib/food/saved-data";
import { mealTypeAt } from "@/lib/food/items";
import { loadRecentMeals, type RecentMeal } from "@/lib/food/recent";
import { QuickAddMeal } from "@/components/diary/quick-add";
import { getDictionary } from "@/lib/i18n/he";
import { loadDayLog, loadDayLogRange, rememberTasks } from "@/lib/menu/data";
import { toView } from "@/lib/menu/view";
import { generateWeekPlan, loadDayTasks, loadWeek } from "@/lib/plan/data";
import { PER_SIDE } from "@/lib/plan/duration";
import { loadWorkoutPool, type WorkoutPool } from "@/lib/workout/data";
import type { ExerciseCard } from "@/lib/workout/today";
import { groupOf, type WorkoutItem } from "@/lib/workout/build";
import { addDays, weekdayOf, weekStartOf } from "@/lib/plan/week";
import { bmiOf } from "@/lib/progress/bmi";
import { loadRecentWeights } from "@/lib/progress/data";
import { loadWaterToday } from "@/lib/water/data";
import { dailyWaterTargetMl } from "@/lib/water/plan";
import { localDay } from "@/lib/water/time";

const t = getDictionary();
const s = t.screens.today;

export const metadata: Metadata = { title: s.title };

const longDate = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default function TodayPage() {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Today />
    </Suspense>
  );
}

const mid = (r: [number, number] | null | undefined) => (r ? Math.round((r[0] + r[1]) / 2) : null);

/**
 * The one screen to follow the day: competitions, today's / this week's status, the menu and
 * the workout. Everything else is one tap away.
 */
async function Today() {
  const user = await requireUser();
  const { date, minutes } = localDay(new Date());
  const ctx = await loadDayContext(user.id);
  const name = ctx.draft.display_name;

  if (!ctx.ready) {
    return (
      <>
        <Header name={name} date={date} seed={user.id} avatar={ctx.draft.avatar} />
        <EmptyState
          icon={<ClipboardList aria-hidden="true" />}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={
            <ButtonLink href="/onboarding">
              {s.emptyCta}
              <ArrowLeft aria-hidden="true" className="size-4" />
            </ButtonLink>
          }
        />
      </>
    );
  }

  const weekStart = weekStartOf(date);
  // Everything at once: one round of requests instead of a chain.
  const tasksOf = () => loadDayTasks(user.id, date).catch(() => ({ hasPlan: false, tasks: [] as Awaited<ReturnType<typeof loadDayTasks>>["tasks"] }));
  let [week, tasks] = await Promise.all([loadWeek(user.id, weekStart).catch(() => null), tasksOf()]);
  const rest = Promise.all([
    loadDayLog(user.id, date),
    loadFoodDay(user.id, date).catch(() => null),
    loadWaterToday(user.id).catch(() => null),
    ctx.hideWeight ? Promise.resolve([]) : loadRecentWeights(user.id, date).catch(() => []),
    loadScores(user.id, addDays(date, -7), addDays(date, -1)).catch(() => new Map()),
    loadWorkoutPool(ctx.draft).catch((): WorkoutPool => ({ pool: [], cards: {}, ids: new Map() })),
    loadDayLogRange(user.id, addDays(date, -7), addDays(date, -1)).catch(() => new Map() as Awaited<ReturnType<typeof loadDayLogRange>>),
    loadFoodDay(user.id, addDays(date, -1)).catch(() => null),
    loadSavedFoods(user.id).catch(() => []),
    loadRecentMeals(user.id, date).catch((): RecentMeal[] => []),
  ]);
  // The week's plan is made on its own the first time the week is opened.
  if (!week) {
    const made = await generateWeekPlan(user.id, weekStart).catch(() => null);
    if (made?.ok) [week, tasks] = await Promise.all([loadWeek(user.id, weekStart).catch(() => null), tasksOf()]);
  }
  const [day, food, water, weights, scores, pool, past7, yFood, savedFoods, recent] = await rest;
  const past = [...scores.values()].map((x) => x.score);
  const history = { yesterday: scores.get(addDays(date, -1))?.score ?? null, weekAvg: past.length ? Math.round(past.reduce((a, b) => a + b, 0) / past.length) : null };

  // Today's workout: the one the user set on the home screen, or else the plan's.
  const planDay = week?.plan.days[weekdayOf(date)];
  const w = planDay?.workout ?? null;
  const cards: Record<string, ExerciseCard> = { ...pool.cards };
  const planItems: WorkoutItem[] = (w?.blocks ?? []).flatMap((b) => {
    const ex = week?.exercises.get(b.exercise_id);
    if (!ex) return [];
    cards[ex.slug] ??= { name: ex.name_he, primary: ex.primary_muscles, steps: ex.instructions_he.split("\n").filter(Boolean), cautions: ex.cautions_he, perSide: PER_SIDE.has(ex.slug) };
    const base = { slug: ex.slug, sets: b.sets, rest: b.rest_seconds };
    return [b.seconds ? { ...base, seconds: b.seconds } : { ...base, reps: b.reps ?? 10 }];
  });
  const own = day.fitness.workout;
  const todayWorkout = own ?? (planItems.length ? { minutes: null, items: planItems } : null);
  const exCount = todayWorkout?.items.length ?? 0;
  const doneBlocks = day.fitness.done.filter((k) => k.startsWith("ex:") && Number(k.slice(3)) < exCount).length;

  // Protein eaten at each meal, so "protein at breakfast" ticks itself.
  const mealProtein = (meal: string) =>
    (food?.logs ?? []).filter((l) => l.status === "confirmed" && l.mealType === meal).reduce((a, l) => a + l.items.reduce((x, i) => x + (i.protein_g ?? 0), 0), 0);
  const taskInput: Omit<SmartTaskInput, "workoutToday"> = {
    goals: ctx.draft.goals,
    experience: ctx.draft.experience,
    activityLevel: ctx.draft.activity_level,
    age: ctx.draft.age,
    bmi: bmiOf(ctx.weightKg, ctx.heightCm),
    weightKg: ctx.weightKg,
    sleepHours: ctx.draft.sleep_hours,
    lowIntensityOnly: ctx.lowIntensityOnly,
    needsDoctor: ctx.needsDoctor,
    hideNumbers: !ctx.showNumbers,
    weeksIn: ctx.weeksIn,
    proteinTarget: ctx.protein,
  };
  // The small tasks: the ones given earlier today, or a fresh set chosen from the last days'
  // tasks, how yesterday's food went and today's workout, kept with the day.
  const groups = [...new Set((todayWorkout?.items ?? []).flatMap((i) => {
    const e = pool.pool.find((x) => x.slug === i.slug);
    return e ? [groupOf(e)] : [];
  }))];
  const fullInput: SmartTaskInput = { ...taskInput, workoutToday: Boolean(todayWorkout), workoutGroups: groups, date };
  let given = day.fitness.tasks?.length ? tasksByIds(fullInput, day.fitness.tasks) : [];
  if (!given.length) {
    const history = [...past7.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([, d]) => ({ given: d.fitness.tasks ?? [], done: d.fitness.done.filter((k) => k.startsWith("t:")).map((k) => k.slice(2)) }));
    const yKcal = mid(yFood?.totals.kcal);
    const satisfied: SmartTaskKind[] = [];
    if (mealProtein("breakfast") >= 15) satisfied.push("protein_breakfast");
    if (mealProtein("lunch") >= 20) satisfied.push("protein_lunch");
    if (ctx.protein && (food?.totals.protein ?? 0) >= ctx.protein / 2) satisfied.push("protein_half");
    for (const k of ["walk", "brisk_walk", "jog", "aerobic", "stretch"] as const) if (minutesFor(k, day.fitness.acts) >= 10) satisfied.push(k);
    given = smartTasks({
      ...fullInput,
      history,
      satisfied,
      yesterday: yFood ? { kcal: yKcal, kcalTarget: ctx.target, protein: yFood.totals.protein } : null,
    });
    if (day.saved && given.length) await rememberTasks(user.id, date, given.map((t) => t.id)).catch(() => {});
  }
  const small: SmallTask[] = given.map((t) => ({
    id: t.id,
    kind: t.kind,
    title: t.title,
    why: t.why,
    minutes: t.minutes,
    grams: t.grams,
    auto:
      (t.kind === "protein_breakfast" && mealProtein("breakfast") >= 15) ||
      (t.kind === "protein_lunch" && mealProtein("lunch") >= 20) ||
      (t.kind === "protein_half" && Boolean(t.grams) && (food?.totals.protein ?? 0) >= (t.grams ?? 0)),
  }));

  const waterTask = tasks.tasks.find((x) => x.type === "water") ?? null;
  const waterTarget = water
    ? dailyWaterTargetMl({ weightKg: water.weightKg, workoutToday: Boolean(todayWorkout), medicalRestriction: water.medicalRestriction })
    : null;

  const protein = ctx.protein;
  const weight = ctx.hideWeight ? null : { history: weights, startKg: ctx.draft.weight_kg ?? ctx.weightKg, heightCm: ctx.heightCm, today: date };

  return (
    <DayProvider eatenKcal={mid(food?.totals.kcal) ?? 0} eatenProtein={food?.totals.protein ?? 0} workout={{ done: doneBlocks, total: exCount }} activeMinutes={day.fitness.acts.reduce((a, x) => a + x.min, 0)}>
      <Header name={name} date={date} seed={user.id} avatar={ctx.draft.avatar} />
      <Suspense fallback={<div className="h-[76px] animate-pulse rounded-[var(--radius-card)] bg-white/60" aria-hidden="true" />}>
        <Competitions userId={user.id} today={date} me={{ seed: user.id, avatar: ctx.draft.avatar }} />
      </Suspense>
      <DaySummary target={ctx.showNumbers ? ctx.target : null} proteinTarget={protein} minutes={minutes} history={history} persist={day.saved} />
      <DayExtras
        water={water ? { drank: water.logs.reduce((a, b) => a + b, 0), target: waterTarget, vesselMl: water.vesselMl, taskId: waterTask?.id ?? null } : null}
        weight={weight}
      />
      <MenuCard initial={toView(day.menu, ctx.profile)} showNumbers={ctx.showNumbers} saved={day.saved} aiEnabled={Boolean(process.env.GEMINI_API_KEY)} savedFoods={savedFoods} />
      <TodayWorkout
        initial={todayWorkout}
        title={own ? null : (w?.title ?? null)}
        pool={pool.pool}
        cards={cards}
        done={day.fitness.done}
        seed={`${user.id}:${date}`}
        level={ctx.lowIntensityOnly ? "beginner" : (ctx.draft.experience ?? "beginner")}
        saved={day.saved}
      />
      <FitnessCard tasks={small} initial={day.fitness} weightKg={ctx.weightKg} saved={day.saved} />
      <QuickAddMeal defaultMeal={mealTypeAt(minutes)} recent={recent} showNumbers={ctx.showNumbers} photoEnabled={Boolean(process.env.GEMINI_API_KEY)} />
    </DayProvider>
  );
}

/** Streams in on its own: one request per competition should not hold up the rest of the day. */
async function Competitions({ userId, today, me }: { userId: string; today: string; me: { seed: string; avatar: AvatarConfig | null } }) {
  const items = await competitionCards(userId).catch(() => []);
  return <CompetitionsStrip items={items} today={today} me={me} />;
}

function Header({ name, date, seed, avatar }: { name: string; date: string; seed: string; avatar: AvatarConfig | null }) {
  return (
    <header className="flex items-center justify-between gap-3 pt-1">
      <span className="flex min-w-0 items-center gap-2.5">
        <Link href="/profile" aria-label="הפרופיל שלי" className="shrink-0 rounded-full">
          <FaceAvatar seed={seed} config={avatar} size={44} />
        </Link>
        <span className="flex min-w-0 flex-col">
          <h1 className="truncate text-2xl leading-tight font-semibold">{name ? `היי ${name.trim()}` : s.title}</h1>
          <span className="text-xs text-ink-muted sm:hidden">{longDate.format(new Date(`${date}T12:00:00Z`))}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="hidden text-sm text-ink-muted sm:inline">{longDate.format(new Date(`${date}T12:00:00Z`))}</span>
        <Link
          href="/coach"
          aria-label="שאלה למאמן"
          className="flex min-h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-medium shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] hover:bg-white"
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          מאמן
        </Link>
      </span>
    </header>
  );
}
