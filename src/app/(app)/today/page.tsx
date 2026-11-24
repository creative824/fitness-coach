import type { Metadata } from "next";
import { ArrowLeft, ClipboardList, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FaceAvatar } from "@/components/ui/face-avatar";
import type { AvatarConfig } from "@/lib/avatar";
import { CompetitionsStrip } from "@/components/home/competitions-strip";
import { DayProvider } from "@/components/home/day-context";
import { FitnessCard, type SmallTask, type WorkoutBlock } from "@/components/home/fitness-card";
import { MenuCard } from "@/components/home/menu-card";
import { DaySummary } from "@/components/home/day-summary";
import { DayExtras } from "@/components/home/day-extras";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { EXERCISES } from "@/content/exercises";
import { competitionCards } from "@/lib/competitions/data";
import { loadDayContext } from "@/lib/day/context";
import { proteinTarget } from "@/lib/day/scores";
import { smartTasks, type SmartTaskInput } from "@/lib/day/smart-tasks";
import { requireUser } from "@/lib/data/user";
import { loadFoodDay } from "@/lib/food/data";
import { getDictionary } from "@/lib/i18n/he";
import { loadDayLog } from "@/lib/menu/data";
import { toView } from "@/lib/menu/view";
import { generateWeekPlan, loadDayTasks, loadWeek } from "@/lib/plan/data";
import { PER_SIDE } from "@/lib/plan/duration";
import { weekdayOf, weekStartOf } from "@/lib/plan/week";
import { bmiOf } from "@/lib/progress/bmi";
import { loadRecentWeights } from "@/lib/progress/data";
import { loadWaterToday } from "@/lib/water/data";
import { dailyWaterTargetMl } from "@/lib/water/plan";
import { localDay } from "@/lib/water/time";

const t = getDictionary();
const s = t.screens.today;

export const metadata: Metadata = { title: s.title };

const easierName = new Map(EXERCISES.map((e) => [e.slug, e.name_he]));
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
  ]);
  // The week's plan is made on its own the first time the week is opened.
  if (!week) {
    const made = await generateWeekPlan(user.id, weekStart).catch(() => null);
    if (made?.ok) [week, tasks] = await Promise.all([loadWeek(user.id, weekStart).catch(() => null), tasksOf()]);
  }
  const [day, food, water, weights] = await rest;

  const planDay = week?.plan.days[weekdayOf(date)];
  const w = planDay?.workout ?? null;
  const blocks: WorkoutBlock[] = (w?.blocks ?? []).flatMap((b, index) => {
    const ex = week?.exercises.get(b.exercise_id);
    if (!ex) return [];
    return [
      {
        index,
        slug: ex.slug,
        name: ex.name_he,
        sets: b.sets,
        reps: b.reps,
        seconds: b.seconds,
        rest: b.rest_seconds,
        perSide: PER_SIDE.has(ex.slug),
        primary: ex.primary_muscles,
        steps: ex.instructions_he.split("\n").filter(Boolean),
        cautions: ex.cautions_he,
        easier: ex.easier_slug ? (easierName.get(ex.easier_slug) ?? null) : null,
      },
    ];
  });
  const workout = w && blocks.length ? { title: w.title, minutes: w.estimated_minutes, blocks } : null;
  const doneBlocks = blocks.filter((b) => day.fitness.done.includes(`ex:${b.index}`)).length;

  const confirmedMeals = food?.logs.filter((l) => l.status === "confirmed").length ?? 0;
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
  };
  const small: SmallTask[] = smartTasks({ ...taskInput, workoutToday: Boolean(workout) }).map((t) => ({
    id: t.id,
    kind: t.kind,
    title: t.title,
    why: t.why,
    minutes: t.minutes,
    grams: t.grams,
    auto: (t.kind === "log_food" && confirmedMeals >= 3) || (t.kind === "protein" && Boolean(t.grams) && (food?.totals.protein ?? 0) >= (t.grams ?? 0)),
  }));

  const waterTask = tasks.tasks.find((x) => x.type === "water") ?? null;
  const waterTarget = water
    ? dailyWaterTargetMl({ weightKg: water.weightKg, workoutToday: Boolean(workout), medicalRestriction: water.medicalRestriction })
    : null;

  const protein = ctx.showNumbers ? proteinTarget(ctx.draft.goals, ctx.weightKg) : null;
  const weight = ctx.hideWeight ? null : { history: weights, startKg: ctx.draft.weight_kg ?? ctx.weightKg, heightCm: ctx.heightCm, today: date };

  return (
    <DayProvider eatenKcal={mid(food?.totals.kcal) ?? 0} eatenProtein={food?.totals.protein ?? 0} workout={{ done: doneBlocks, total: blocks.length }} activeMinutes={day.fitness.acts.reduce((a, x) => a + x.min, 0)}>
      <Header name={name} date={date} seed={user.id} avatar={ctx.draft.avatar} />
      <Suspense fallback={<div className="h-[76px] animate-pulse rounded-[var(--radius-card)] bg-white/60" aria-hidden="true" />}>
        <Competitions userId={user.id} today={date} me={{ seed: user.id, avatar: ctx.draft.avatar }} />
      </Suspense>
      <DaySummary target={ctx.showNumbers ? ctx.target : null} proteinTarget={protein} minutes={minutes} />
      <DayExtras
        water={water ? { drank: water.logs.reduce((a, b) => a + b, 0), target: waterTarget, vesselMl: water.vesselMl, taskId: waterTask?.id ?? null } : null}
        weight={weight}
      />
      <MenuCard initial={toView(day.menu, ctx.profile)} showNumbers={ctx.showNumbers} saved={day.saved} aiEnabled={Boolean(process.env.GEMINI_API_KEY)} />
      <FitnessCard workout={workout} tasks={small} initial={day.fitness} weightKg={ctx.weightKg} saved={day.saved} />
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
