"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { FoodEntry, kcalOf, useFoodEntry } from "@/components/food/food-entry";
import type { SaveFood } from "@/components/food/recipe-calculator";
import type { UnderstandMealResult } from "@/lib/food/estimate";
import type { Understanding } from "@/lib/food/recipe";
import { DayProvider, useDay } from "@/components/home/day-context";
import { FitnessCard, type SmallTask } from "@/components/home/fitness-card";
import { TodayWorkout } from "@/components/workout/today-workout";
import { DayExtras } from "@/components/home/day-extras";
import { DaySummary } from "@/components/home/day-summary";
import { AvatarEditor } from "@/components/ui/avatar-editor";
import { FaceAvatar } from "@/components/ui/face-avatar";
import { avatarFromSeed, type AvatarConfig } from "@/lib/avatar";
import { EXERCISES } from "@/content/exercises";
import { proteinTarget } from "@/lib/day/scores";
import { smartTasks, type SmartTaskInput } from "@/lib/day/smart-tasks";
import { totalsOf, type FoodItem } from "@/lib/food/items";
import { describeItem } from "@/lib/food/parse";
import type { DietProfile } from "@/lib/menu/engine";
import type { GoalType } from "@/lib/onboarding/schema";
import { PER_SIDE } from "@/lib/plan/duration";
import { filterExercises } from "@/lib/plan/candidates";
import { buildWorkout, type PoolExercise, type WorkoutItem } from "@/lib/workout/build";
import type { ExerciseCard } from "@/lib/workout/today";
import { calorieTarget } from "@/lib/plan/targets";
import { bmiOf } from "@/lib/progress/bmi";
import { screenSafety } from "@/lib/safety/screen";

interface Person {
  id: string;
  label: string;
  about: string;
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  goals: GoalType[];
  experience: SmartTaskInput["experience"];
  activityLevel: SmartTaskInput["activityLevel"];
  sleepHours: number;
  mealsPerDay: number;
  diet: DietProfile;
  equipment: string[];
  workout: { title: string; minutes: number; slugs: [string, number, number][] } | null;
}

/** Three sample people, so the same screen can be tried with different goals. */
const PEOPLE: Person[] = [
  {
    id: "lose",
    label: "ירידה במשקל",
    about: "בן 36, 92 ק״ג, יושב רוב היום, מתחיל",
    age: 36, sex: "male", heightCm: 175, weightKg: 92, goals: ["lose_weight"], experience: "beginner", activityLevel: "sedentary", sleepHours: 6, mealsPerDay: 3,
    diet: { pattern: "omnivore", allergies: [], avoid: [] },
    equipment: [],
    workout: null,
  },
  {
    id: "muscle",
    label: "בניית שריר",
    about: "בן 27, 74 ק״ג, פעיל, יום אימון",
    age: 27, sex: "male", heightCm: 180, weightKg: 74, goals: ["muscle"], experience: "intermediate", activityLevel: "moderate", sleepHours: 7.5, mealsPerDay: 5,
    diet: { pattern: "omnivore", allergies: [], avoid: [] },
    equipment: ["dumbbells"],
    workout: { title: "גוף מלא", minutes: 35, slugs: [["goblet-squat", 4, 10], ["push-up", 3, 12], ["db-row", 3, 12], ["plank", 3, 40]] },
  },
  {
    id: "fit",
    label: "כושר ושמירה",
    about: "בת 45, 66 ק״ג, צמחונית, רוצה גמישות",
    age: 45, sex: "female", heightCm: 164, weightKg: 66, goals: ["maintain_weight", "flexibility"], experience: "beginner", activityLevel: "light", sleepHours: 7, mealsPerDay: 6,
    diet: { pattern: "vegetarian", allergies: [], avoid: [] },
    equipment: [],
    workout: { title: "כוח ויציבות", minutes: 25, slugs: [["bodyweight-squat", 3, 15], ["knee-push-up", 3, 10], ["glute-bridge", 3, 15], ["bird-dog", 2, 10]] },
  },
];

const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

function setupFor(p: Person) {
  const safety = screenSafety({ answers: {}, goals: p.goals, height_cm: p.heightCm, weight_kg: p.weightKg, target_weight_kg: null });
  const cal = calorieTarget({ age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, sex: p.sex, activityLevel: p.activityLevel, goals: p.goals, experience: p.experience, availableDays: [0, 2, 4], safety });
  const target = cal?.kcal ?? 2000;
  // The sample person's exercise pool, filtered the same way as a real user's.
  const rows = filterExercises(
    EXERCISES.map((e) => ({ id: e.slug, slug: e.slug, name_he: e.name_he, category: e.category, mode: e.mode, difficulty: e.difficulty, equipment: e.equipment, primary_muscles: e.primary, contraindications: e.contraindications })),
    { experience: p.experience, location: ["home"], equipment: p.equipment, limitations: "", safety },
  );
  const allowed = new Set(rows.map((r) => r.slug));
  const pool: PoolExercise[] = rows.map((r) => {
    const e = bySlug.get(r.slug)!;
    return { slug: r.slug, name: r.name_he, category: r.category, mode: r.mode, difficulty: r.difficulty, primary: r.primary_muscles, easier: e.easier && allowed.has(e.easier) ? e.easier : null };
  });
  const cards: Record<string, ExerciseCard> = Object.fromEntries(
    EXERCISES.map((e) => [e.slug, { name: e.name_he, primary: e.primary, steps: e.steps, cautions: e.cautions, perSide: PER_SIDE.has(e.slug) }]),
  );
  const planned: WorkoutItem[] = (p.workout?.slugs ?? []).flatMap(([slug, sets, n]) => {
    const e = bySlug.get(slug);
    if (!e) return [];
    return [e.mode === "seconds" ? { slug, sets, seconds: n, rest: 60 } : { slug, sets, reps: n, rest: 60 }];
  });
  const items = planned.length ? planned : buildWorkout(pool, 15, p.id, p.experience ?? "beginner");
  const workout = { title: p.workout?.title ?? null, items, minutes: planned.length ? null : (15 as const) };
  const tasks: SmallTask[] = smartTasks({
    goals: p.goals, experience: p.experience, activityLevel: p.activityLevel, age: p.age, bmi: bmiOf(p.weightKg, p.heightCm), weightKg: p.weightKg, sleepHours: p.sleepHours,
    lowIntensityOnly: false, needsDoctor: false, hideNumbers: false, workoutToday: true, weeksIn: 0,
    date: `2026-01-${10 + p.id.length}`, proteinTarget: proteinTarget(p.goals, p.weightKg, { heightCm: p.heightCm, activityLevel: p.activityLevel }),
  }).map((t) => ({ id: t.id, kind: t.kind, title: t.title, why: t.why, minutes: t.minutes, grams: t.grams, auto: false }));
  return { target, tasks, weight: sampleWeights(p), protein: proteinTarget(p.goals, p.weightKg, { heightCm: p.heightCm, activityLevel: p.activityLevel }), workout, pool, cards };
}

export function DemoDay() {
  const [who, setWho] = useState(PEOPLE[0].id);
  const person = PEOPLE.find((p) => p.id === who)!;
  const [locked, setLocked] = useState(false);
  const [avatar, setAvatar] = useState<AvatarConfig>(() => avatarFromSeed("demo-visitor"));
  const [editing, setEditing] = useState(false);
  // Links into the app's own pages need an account: keep the visitor here and say so.
  function stayHere(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href") ?? "";
    if (a && href.startsWith("/") && !href.startsWith("/signup")) {
      e.preventDefault();
      setLocked(true);
    }
  }
  return (
    <div className="contents" onClickCapture={stayHere}>
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-accent-soft p-4 ring-1 ring-accent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">גרסת ניסיון, בלי הרשמה</h1>
            <p className="text-sm text-ink-muted">אפשר ללחוץ על הכול. שום דבר לא נשמר. בחרו אדם לדוגמה:</p>
          </div>
          <Link href="/signup" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium underline underline-offset-4">
            להרשמה
            <ArrowLeft aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
        <div role="tablist" aria-label="אדם לדוגמה" className="grid grid-cols-3 gap-1.5">
          {PEOPLE.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={who === p.id}
              onClick={() => {
                setWho(p.id);
                setLocked(false);
              }}
              className={`min-h-11 cursor-pointer rounded-xl px-2 text-sm font-medium transition-colors ${who === p.id ? "bg-brand text-white" : "bg-surface hover:bg-white"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">{person.about}</p>
        {editing ? (
          <div className="flex flex-col gap-3 rounded-xl bg-surface p-3">
            <AvatarEditor value={avatar} onChange={setAvatar} name="האווטאר שלך" />
            <button type="button" onClick={() => setEditing(false)} className="min-h-10 cursor-pointer rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong">
              סיום
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface p-2.5 text-start hover:bg-white">
            <FaceAvatar seed="me" config={avatar} size={44} />
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-medium">האווטאר שלך</span>
              <span className="text-xs text-ink-muted">בהרשמה כל אחד יוצר לעצמו. נסו כאן.</span>
            </span>
            <span className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">יצירה</span>
          </button>
        )}
      </div>
      {locked ? (
        <p role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
          <span>המסך הזה זמין אחרי הרשמה. בגרסת הניסיון רואים רק את היום.</span>
          <button type="button" onClick={() => setLocked(false)} className="shrink-0 cursor-pointer underline">
            סגירה
          </button>
        </p>
      ) : null}
      <PersonDay key={person.id} person={person} avatar={avatar} />
    </div>
  );
}

/** Sample weigh-ins: weekly, the last one 4 days ago, so the reminder shows. */
function sampleWeights(p: Person) {
  const drift = p.goals.includes("lose_weight") ? -0.45 : p.goals.includes("muscle") ? 0.2 : 0.05;
  const dates = ["2025-12-14", "2025-12-21", "2025-12-28", "2026-01-04", "2026-01-11"];
  const history = dates.map((date, i) => ({ date, kg: Math.round((p.weightKg + drift * (i - (dates.length - 1))) * 10) / 10 }));
  return { history, startKg: history[0].kg, heightCm: p.heightCm, today: "2026-01-15" };
}

function PersonDay({ person, avatar }: { person: Person; avatar: AvatarConfig }) {
  const [setup] = useState(() => setupFor(person));
  /** Food added in the demo diary. */
  const extraRef = useRef({ kcal: 0, protein: 0 });
  const eaten = () => ({ kcal: extraRef.current.kcal, protein: Math.round(extraRef.current.protein) });

  return (
    <DayProvider eatenKcal={0} workout={{ done: 0, total: setup.workout.items.length }} activeMinutes={0}>
      <DemoCompetition you={person.label} avatar={avatar} />
      <DaySummary target={setup.target} proteinTarget={setup.protein} minutes={12 * 60} trackHref={null} />
      <DayExtras water={null} weight={setup.weight} localWeight />
      <TodayWorkout
        initial={{ minutes: setup.workout.minutes, items: setup.workout.items }}
        title={setup.workout.title}
        pool={setup.pool}
        cards={setup.cards}
        done={[]}
        seed={person.id}
        level={person.experience ?? "beginner"}
        saved
        demo
      />
      <FitnessCard tasks={setup.tasks} initial={{ done: [], acts: [] }} weightKg={person.weightKg} saved demo />
      <DemoDiary
        onAdd={(k, p) => {
          extraRef.current = { kcal: extraRef.current.kcal + k, protein: extraRef.current.protein + p };
        }}
        eaten={eaten}
      />
    </DayProvider>
  );
}

/** The food diary of the demo: type what you ate, see the calories, add it to the day. */
/**
 * The demo has no AI: one sample recipe stands in for what Gemini would understand from it.
 * The numbers are still counted by the real engine (recipe.ts), and saving stays in the page.
 */
const DEMO_RECIPE = "הכנתי טראפלס מחפיסת שוקולד מריר, צנצנת שלמה של חמאת בוטנים טבעית ובערך כוס קורנפלקס. יצאו בערך 40 כדורים ואכלתי 6-7";
const DEMO_TRUFFLES: Understanding = {
  dish: "טראפלס",
  kind: "recipe",
  ingredients: [
    { name: "שוקולד מריר", qty: 1, unit: "package", approx: false, per100: { kcal: 550, p: 7, c: 45, f: 38 } },
    { name: "חמאת בוטנים טבעית", qty: 1, unit: "package", approx: false, per100: { kcal: 600, p: 25, c: 20, f: 50 } },
    { name: "קורנפלקס", qty: 1, unit: "cup", approx: true, per100: { kcal: 380, p: 6, c: 85, f: 1 } },
  ],
  yieldUnits: { min: 40, max: 40 },
  unitName: "כדורים",
  eaten: { min: 6, max: 7 },
};
async function demoUnderstand(text: string): Promise<UnderstandMealResult> {
  await new Promise((r) => setTimeout(r, 500));
  return /טראפלס/.test(text) ? { ok: true, understanding: DEMO_TRUFFLES } : { ok: false, reason: "no_key" };
}
const demoSave: SaveFood = async (input) => ({ ok: true, food: { id: `demo-${input.name}`, name: input.name, kind: input.kind, unitName: input.unitName, yieldUnits: input.yieldUnits, perUnit: input.perUnit, accuracy: input.accuracy, recipe: input.recipe } });

function DemoDiary({ onAdd, eaten }: { onAdd: (kcal: number, protein: number) => void; eaten: () => { kcal: number; protein: number } }) {
  const { setEatenKcal, setEatenProtein } = useDay();
  const entry = useFoodEntry();
  const [logs, setLogs] = useState<{ text: string; items: FoodItem[]; kcal: number }[]>([]);
  const [saving, start] = useTransition();

  function save() {
    const kcal = entry.kcal;
    const item = { text: entry.text, items: entry.items, kcal };
    start(async () => {
      onAdd(kcal, totalsOf(item.items).protein ?? 0);
      const now = eaten();
      setEatenKcal(now.kcal);
      setEatenProtein(now.protein);
      setLogs((l) => [...l, item]);
      entry.reset();
    });
  }

  return (
    <section aria-labelledby="diary-title" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <h2 id="diary-title" className="text-lg font-semibold">
        יומן אוכל
      </h2>
      <p className="-mt-1 text-xs text-ink-muted">נסו מתכון: &quot;{DEMO_RECIPE}&quot;</p>
      <FoodEntry entry={entry} aiEnabled={false} showNumbers understand={demoUnderstand} save={demoSave} />
      <button
        type="button"
        onClick={save}
        disabled={saving || entry.text.trim().length < 2}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
        {entry.kcal ? (
          <>
            הוספה להיום · <span className="num">{entry.kcal}</span> קל׳
          </>
        ) : (
          "הוספה להיום"
        )}
      </button>
      {logs.length ? (
        <ul className="flex flex-col gap-2">
          {logs.map((l, k) => (
            <li key={k} className="flex flex-col gap-1 rounded-xl bg-field p-3 text-sm">
              <span className="font-medium">{l.text}</span>
              {l.items.map((i, n) => (
                <span key={n} className="flex justify-between text-xs text-ink-muted">
                  <span>{describeItem(i)}</span>
                  <span className="num">{kcalOf(i)}</span>
                </span>
              ))}
              <span className="flex justify-between">
                <span className="text-ink-muted">סה״כ</span>
                <span>
                  <span className="num font-semibold">{l.kcal}</span> קל׳
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const RIVALS = ["דנה", "יוסי", "מיכל", "אבי", "נועה"];

/** Two sample competitions as compact cards; a tap opens the table of that competition. */
function DemoCompetition({ you, avatar }: { you: string; avatar: AvatarConfig }) {
  const comps = [
    {
      id: "nov",
      name: "תחרות נובמבר",
      left: "נשארו 6 ימים",
      people: [
        { key: "demo-dana", name: RIVALS[0], score: 3.8 },
        { key: "demo-you", name: "את/ה", score: 3.1, me: true },
        { key: "demo-yossi", name: RIVALS[1], score: 2.6 },
        { key: "demo-michal", name: RIVALS[2], score: 2.2 },
        { key: "demo-avi", name: RIVALS[3], score: 1.4 },
        { key: "demo-noa", name: RIVALS[4], score: 0.9 },
      ],
    },
    {
      id: "office",
      name: "המשרד",
      left: "נשארו 12 ימים",
      people: [
        { key: "demo-you", name: "את/ה", score: 2.4, me: true },
        { key: "demo-avi", name: RIVALS[3], score: 1.9 },
        { key: "demo-michal", name: RIVALS[2], score: 1.1 },
        { key: "demo-noa", name: RIVALS[4], score: 0.4 },
      ],
    },
  ];
  const [open, setOpen] = useState<string | null>(null);
  const shown = comps.find((c) => c.id === open) ?? null;
  return (
    <section aria-labelledby="demo-comp" className="flex flex-col gap-2">
      <h2 id="demo-comp" className="text-sm font-semibold">
        התחרויות שלי <span className="font-normal text-ink-muted">(לדוגמה)</span>
      </h2>
      <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {comps.map((c) => {
          const rank = c.people.findIndex((p) => p.me) + 1;
          const mine = c.people[rank - 1];
          return (
            <li key={c.id} className="w-[72%] shrink-0 snap-start sm:w-60">
              <button
                type="button"
                aria-expanded={open === c.id}
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className={`flex h-full w-full cursor-pointer flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-3 text-start shadow-[var(--shadow-card)] ring-1 transition-shadow hover:shadow-[var(--shadow-float)] ${open === c.id ? "ring-ink/40" : "ring-ink/[0.04]"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <span className="shrink-0 text-[11px] text-ink-muted">{c.left}</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="relative shrink-0">
                    <FaceAvatar seed={"demo-you" + you} config={avatar} size={40} />
                    {rank === 1 ? (
                      <span aria-hidden="true" className="absolute -top-2 -end-1 text-sm">
                        👑
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm">
                      מקום <span className="num text-base font-bold">{rank}</span>
                      <span className="text-ink-muted">
                        {" "}
                        מתוך <span className="num">{c.people.length}</span>
                      </span>
                    </span>
                    <span className="text-xs text-ink-muted">
                      ירידה של <span className="num font-semibold text-accent-strong">{mine.score.toFixed(1)}%</span>
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown ? <DemoTable people={shown.people} you={you} avatar={avatar} /> : null}
    </section>
  );
}

function DemoTable({ people, you, avatar }: { people: { key: string; name: string; score: number; me?: boolean }[]; you: string; avatar: AvatarConfig }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <ol className="flex flex-col gap-1.5">
        {people.map((p, i) => (
          <li key={p.key} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.me ? "bg-accent-soft ring-1 ring-accent" : "bg-field"}`}>
            <span className="num w-5 text-center text-sm font-semibold">{i === 0 ? "👑" : i + 1}</span>
            <FaceAvatar seed={p.key + you} config={p.me ? avatar : null} size={32} />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            <span className="num text-sm font-semibold">{p.score.toFixed(1)}%</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-muted">כאן רואים רק אחוזים, אף פעם לא קילוגרמים.</p>
    </div>
  );
}
