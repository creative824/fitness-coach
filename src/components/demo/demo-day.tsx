"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { FoodEntry, kcalOf, useFoodEntry } from "@/components/food/food-entry";
import { DayProvider, useDay } from "@/components/home/day-context";
import { FitnessCard, type SmallTask, type WorkoutBlock } from "@/components/home/fitness-card";
import { MenuCard, type MenuApi } from "@/components/home/menu-card";
import { StatusCard } from "@/components/home/status-card";
import { EXERCISES } from "@/content/exercises";
import { smartTasks, type SmartTaskInput } from "@/lib/day/smart-tasks";
import { totalsOf, type FoodItem } from "@/lib/food/items";
import { describeItem } from "@/lib/food/parse";
import { reshuffle, swapSlot, buildMenu, slotKcal, type DayMenu, type DietProfile } from "@/lib/menu/engine";
import { toView } from "@/lib/menu/view";
import type { MenuResult } from "@/lib/menu/actions";
import type { GoalType } from "@/lib/onboarding/schema";
import { PER_SIDE } from "@/lib/plan/duration";
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
    workout: null,
  },
  {
    id: "muscle",
    label: "בניית שריר",
    about: "בן 27, 74 ק״ג, פעיל, יום אימון",
    age: 27, sex: "male", heightCm: 180, weightKg: 74, goals: ["muscle"], experience: "intermediate", activityLevel: "moderate", sleepHours: 7.5, mealsPerDay: 5,
    diet: { pattern: "omnivore", allergies: [], avoid: [] },
    workout: { title: "גוף מלא", minutes: 35, slugs: [["goblet-squat", 4, 10], ["push-up", 3, 12], ["db-row", 3, 12], ["plank", 3, 40]] },
  },
  {
    id: "fit",
    label: "כושר ושמירה",
    about: "בת 45, 66 ק״ג, צמחונית, רוצה גמישות",
    age: 45, sex: "female", heightCm: 164, weightKg: 66, goals: ["maintain_weight", "flexibility"], experience: "beginner", activityLevel: "light", sleepHours: 7, mealsPerDay: 6,
    diet: { pattern: "vegetarian", allergies: [], avoid: [] },
    workout: { title: "כוח ויציבות", minutes: 25, slugs: [["bodyweight-squat", 3, 15], ["knee-push-up", 3, 10], ["glute-bridge", 3, 15], ["bird-dog", 2, 10]] },
  },
];

const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

function setupFor(p: Person) {
  const safety = screenSafety({ answers: {}, goals: p.goals, height_cm: p.heightCm, weight_kg: p.weightKg, target_weight_kg: null });
  const cal = calorieTarget({ age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, sex: p.sex, activityLevel: p.activityLevel, goals: p.goals, experience: p.experience, availableDays: [0, 2, 4], safety });
  const target = cal?.kcal ?? 2000;
  const menu = buildMenu({ target, mealsPerDay: p.mealsPerDay, profile: p.diet, seed: p.id.length * 977 + 13 });
  const blocks: WorkoutBlock[] = (p.workout?.slugs ?? []).flatMap(([slug, sets, n], index) => {
    const e = bySlug.get(slug);
    if (!e) return [];
    const secs = e.mode === "seconds";
    return [{ index, slug, name: e.name_he, sets, reps: secs ? undefined : n, seconds: secs ? n : undefined, rest: 60, perSide: PER_SIDE.has(slug), primary: e.primary, steps: e.steps, cautions: e.cautions, easier: e.easier ? (bySlug.get(e.easier)?.name_he ?? null) : null }];
  });
  const tasks: SmallTask[] = smartTasks({
    goals: p.goals, experience: p.experience, activityLevel: p.activityLevel, age: p.age, bmi: bmiOf(p.weightKg, p.heightCm), weightKg: p.weightKg, sleepHours: p.sleepHours,
    lowIntensityOnly: false, needsDoctor: false, hideNumbers: false, workoutToday: blocks.length > 0, weeksIn: 0,
  }).map((t) => ({ id: t.id, kind: t.kind, title: t.title, why: t.why, minutes: t.minutes, auto: false }));
  return { target, menu, tasks, workout: p.workout && blocks.length ? { title: p.workout.title, minutes: p.workout.minutes, blocks } : null };
}

export function DemoDay() {
  const [who, setWho] = useState(PEOPLE[0].id);
  const person = PEOPLE.find((p) => p.id === who)!;
  const [locked, setLocked] = useState(false);
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
      </div>
      {locked ? (
        <p role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
          <span>המסך הזה זמין אחרי הרשמה. בגרסת הניסיון רואים רק את היום.</span>
          <button type="button" onClick={() => setLocked(false)} className="shrink-0 cursor-pointer underline">
            סגירה
          </button>
        </p>
      ) : null}
      <PersonDay key={person.id} person={person} />
    </div>
  );
}

const ok = (menu: DayMenu, profile: DietProfile, eaten: number): MenuResult => ({ ok: true, menu: toView(menu, profile), eatenKcal: eaten });

function PersonDay({ person }: { person: Person }) {
  const [setup] = useState(() => setupFor(person));
  const menuRef = useRef(setup.menu);
  /** Food logged outside the menu (the diary and "on top of the menu"). */
  const extraRef = useRef(0);

  const eaten = () => menuRef.current.slots.reduce((a, s) => a + (s.eaten ? slotKcal(s) : 0), 0) + extraRef.current;
  const done = (m: DayMenu) => {
    menuRef.current = m;
    return Promise.resolve(ok(m, person.diet, eaten()));
  };
  const api: MenuApi = {
    eat: (i, yes) => done({ ...menuRef.current, slots: menuRef.current.slots.map((s, k) => (k === i ? { ...s, eaten: yes ? { logId: `demo-${i}` } : null } : s)) }),
    swap: (i) => done(swapSlot(menuRef.current, i, person.diet)),
    swapAll: () => done(reshuffle(menuRef.current, { target: menuRef.current.target, mealsPerDay: person.mealsPerDay, profile: person.diet }, Math.floor(Math.random() * 2 ** 31))),
    other: (input) => {
      const t = totalsOf(input.items as FoodItem[]);
      const kcal = t.kcal ? Math.round((t.kcal[0] + t.kcal[1]) / 2) : null;
      if (input.slot === null) {
        extraRef.current += kcal ?? 0;
        return done(menuRef.current);
      }
      return done({
        ...menuRef.current,
        slots: menuRef.current.slots.map((s, k) => (k === input.slot ? { ...s, eaten: { logId: "demo", custom: { text: input.text.slice(0, 120), kcal } } } : s)),
      });
    },
  };

  return (
    <DayProvider eatenKcal={0} workout={{ done: 0, total: setup.workout?.blocks.length ?? 0 }} activeMinutes={0}>
      <StatusCard target={setup.target} showNumbers week={[]} water={null} weight={{ kg: person.weightKg, bmi: bmiOf(person.weightKg, person.heightCm) }} />
      <MenuCard initial={toView(setup.menu, person.diet)} showNumbers saved aiEnabled={false} api={api} />
      <FitnessCard workout={setup.workout} tasks={setup.tasks} initial={{ done: [], acts: [] }} weightKg={person.weightKg} saved demo />
      <DemoDiary onAdd={(k) => (extraRef.current += k)} eaten={eaten} />
    </DayProvider>
  );
}

/** The food diary of the demo: type what you ate, see the calories, add it to the day. */
function DemoDiary({ onAdd, eaten }: { onAdd: (kcal: number) => void; eaten: () => number }) {
  const { setEatenKcal } = useDay();
  const entry = useFoodEntry();
  const [logs, setLogs] = useState<{ text: string; items: FoodItem[]; kcal: number }[]>([]);
  const [saving, start] = useTransition();

  function save() {
    const kcal = entry.kcal;
    const item = { text: entry.text, items: entry.items, kcal };
    start(async () => {
      onAdd(kcal);
      setEatenKcal(eaten());
      setLogs((l) => [...l, item]);
      entry.reset();
    });
  }

  return (
    <section aria-labelledby="diary-title" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <h2 id="diary-title" className="text-lg font-semibold">
        יומן אוכל
      </h2>
      <FoodEntry entry={entry} aiEnabled={false} showNumbers />
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
