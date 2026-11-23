"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { FoodEntry, kcalOf, useFoodEntry } from "@/components/food/food-entry";
import { DayProvider, useDay } from "@/components/home/day-context";
import { FitnessCard, type SmallTask, type WorkoutBlock } from "@/components/home/fitness-card";
import { MenuCard, type MenuApi } from "@/components/home/menu-card";
import { StatusCard, type WeekDayStat } from "@/components/home/status-card";
import { AvatarEditor } from "@/components/ui/avatar-editor";
import { FaceAvatar, FaceWithName } from "@/components/ui/face-avatar";
import { avatarFromSeed, type AvatarConfig } from "@/lib/avatar";
import { EXERCISES } from "@/content/exercises";
import { proteinTarget } from "@/lib/day/scores";
import { smartTasks, type SmartTaskInput } from "@/lib/day/smart-tasks";
import { totalsOf, type FoodItem } from "@/lib/food/items";
import { describeItem } from "@/lib/food/parse";
import { buildMenu, chooseSlot, renderSlot, reshuffle, slotKcal, swapSlot, type DayMenu, type DietProfile } from "@/lib/menu/engine";
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
  }).map((t) => ({ id: t.id, kind: t.kind, title: t.title, why: t.why, minutes: t.minutes, grams: t.grams, auto: false }));
  return { target, menu, tasks, week: sampleWeek(p.id, target), weight: sampleWeights(p), protein: proteinTarget(p.goals, p.weightKg), workout: p.workout && blocks.length ? { title: p.workout.title, minutes: p.workout.minutes, blocks } : null };
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

const LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** A made-up week up to today, so the weekly view and scores have something to show. */
function sampleWeek(seed: string, target: number): WeekDayStat[] {
  // A fixed sample: today is Thursday, Sunday to Wednesday are behind us.
  const todayIdx = 4;
  let h = seed.length * 7919 + 17;
  const rnd = () => {
    h = (h * 16807) % 2147483647;
    return h / 2147483647;
  };
  return LETTERS.map((letter, i) => {
    const past = i < todayIdx;
    const kcal = past ? Math.round(target * (0.85 + rnd() * 0.3)) : null;
    const off = kcal ? Math.abs(kcal / target - 1) : 0;
    const cal = kcal ? Math.max(0, Math.min(100, off <= 0.1 ? 100 : Math.round(100 - ((off - 0.1) / 0.3) * 100))) : null;
    const date = `sample-${i}`;
    return {
      date,
      letter,
      kcal,
      workout: i % 2 === 1 ? (past ? (rnd() > 0.3 ? "done" : "partial") : "planned") : "none",
      isToday: i === todayIdx,
      future: i > todayIdx,
      calorieScore: cal,
      taskScore: past ? Math.round(55 + rnd() * 40) : null,
    };
  });
}

/** Sample weigh-ins: weekly, the last one 4 days ago, so the reminder shows. */
function sampleWeights(p: Person) {
  const drift = p.goals.includes("lose_weight") ? -0.45 : p.goals.includes("muscle") ? 0.2 : 0.05;
  const dates = ["2025-12-14", "2025-12-21", "2025-12-28", "2026-01-04", "2026-01-11"];
  const history = dates.map((date, i) => ({ date, kg: Math.round((p.weightKg + drift * (i - (dates.length - 1))) * 10) / 10 }));
  return { history, startKg: history[0].kg, heightCm: p.heightCm, today: "2026-01-15" };
}

const ok = (menu: DayMenu, profile: DietProfile, eaten: { kcal: number; protein: number }): MenuResult => ({
  ok: true,
  menu: toView(menu, profile),
  eatenKcal: eaten.kcal,
  eatenProtein: eaten.protein,
});

function PersonDay({ person, avatar }: { person: Person; avatar: AvatarConfig }) {
  const [setup] = useState(() => setupFor(person));
  const menuRef = useRef(setup.menu);
  /** Food logged outside the menu (the diary and "on top of the menu"). */
  const extraRef = useRef({ kcal: 0, protein: 0 });
  /** Protein of meals eaten "instead" of a menu meal, by slot. */
  const insteadProtein = useRef(new Map<number, number>());

  const eaten = () => {
    const slots = menuRef.current.slots;
    const kcal = slots.reduce((a, s) => a + (s.eaten ? slotKcal(s) : 0), 0) + extraRef.current.kcal;
    const protein = slots.reduce((a, s, i) => a + (!s.eaten ? 0 : s.eaten.custom ? (insteadProtein.current.get(i) ?? 0) : (renderSlot(s)?.protein ?? 0)), 0) + extraRef.current.protein;
    return { kcal, protein: Math.round(protein) };
  };
  const done = (m: DayMenu) => {
    menuRef.current = m;
    return Promise.resolve(ok(m, person.diet, eaten()));
  };
  const api: MenuApi = {
    eat: (i, yes) => done({ ...menuRef.current, slots: menuRef.current.slots.map((s, k) => (k === i ? { ...s, eaten: yes ? { logId: `demo-${i}` } : null } : s)) }),
    swap: (i) => done(swapSlot(menuRef.current, i, person.diet)),
    swapAll: () =>
      done(reshuffle(menuRef.current, { target: menuRef.current.target, mealsPerDay: person.mealsPerDay, profile: person.diet, custom: menuRef.current.custom }, Math.floor(Math.random() * 2 ** 31))),
    choose: (i, slug) => done(chooseSlot(menuRef.current, i, slug, person.diet)),
    setKcal: (i, kcal) => {
      const n = menuRef.current.slots.length;
      const list = Array.from({ length: n }, (_, k) => menuRef.current.custom?.[k] ?? null);
      list[i] = kcal;
      if (list.every((x) => x !== null)) return Promise.resolve({ ok: false });
      return done(reshuffle(menuRef.current, { target: menuRef.current.target, mealsPerDay: person.mealsPerDay, profile: person.diet, custom: list }, menuRef.current.seed));
    },
    other: (input) => {
      const t = totalsOf(input.items as FoodItem[]);
      const kcal = t.kcal ? Math.round((t.kcal[0] + t.kcal[1]) / 2) : null;
      if (input.slot === null) {
        extraRef.current = { kcal: extraRef.current.kcal + (kcal ?? 0), protein: extraRef.current.protein + (t.protein ?? 0) };
        return done(menuRef.current);
      }
      insteadProtein.current.set(input.slot, t.protein ?? 0);
      return done({
        ...menuRef.current,
        slots: menuRef.current.slots.map((s, k) => (k === input.slot ? { ...s, eaten: { logId: "demo", custom: { text: input.text.slice(0, 120), kcal } } } : s)),
      });
    },
  };

  return (
    <DayProvider eatenKcal={0} workout={{ done: 0, total: setup.workout?.blocks.length ?? 0 }} activeMinutes={0}>
      <DemoCompetition you={person.label} avatar={avatar} />
      <StatusCard target={setup.target} showNumbers week={setup.week} water={null} weight={setup.weight} localWeight proteinTarget={setup.protein} />
      <MenuCard initial={toView(setup.menu, person.diet)} showNumbers saved aiEnabled={false} api={api} />
      <FitnessCard workout={setup.workout} tasks={setup.tasks} initial={{ done: [], acts: [] }} weightKg={person.weightKg} saved demo />
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

const RIVALS = ["דנה", "יוסי", "מיכל", "אבי", "נועה"];

/** A sample competition: faces with names, so the table reads like people, not a list of words. */
function DemoCompetition({ you, avatar }: { you: string; avatar: AvatarConfig }) {
  const people = [
    { key: "demo-dana", name: RIVALS[0], score: 3.8 },
    { key: "demo-you", name: "את/ה", score: 3.1, me: true },
    { key: "demo-yossi", name: RIVALS[1], score: 2.6 },
    { key: "demo-michal", name: RIVALS[2], score: 2.2 },
    { key: "demo-avi", name: RIVALS[3], score: 1.4 },
    { key: "demo-noa", name: RIVALS[4], score: 0.9 },
  ];
  const [first, second, third] = people;
  return (
    <section aria-labelledby="demo-comp" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="demo-comp" className="font-semibold">
          תחרות דיאטה לדוגמה
        </h2>
        <span className="text-xs text-ink-muted">{you} · מקום 2</span>
      </div>
      <div className="flex items-end justify-center gap-3 rounded-xl bg-field px-3 pt-4 pb-3">
        {[second, first, third].map((p) => (
          <div key={p.key} className={`flex flex-col items-center ${p === first ? "-translate-y-2" : ""}`}>
            {p === first ? <span aria-hidden="true">👑</span> : null}
            <FaceWithName seed={p.key + you} config={p.me ? avatar : null} name={p.name} size={p === first ? 68 : 54} note={`${p.score.toFixed(1)}%`} highlight={Boolean(p.me)} />
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted">המנצח: מי שהוריד הכי הרבה אחוזים מהמשקל שלו. נספר קצב בריא בלבד, עד 1% בשבוע. אחרים רואים רק אחוזים, לא קילוגרמים.</p>
      <ol className="flex flex-col gap-1.5">
        {people.slice(3).map((p, i) => (
          <li key={p.key} className="flex items-center gap-3 rounded-xl bg-field px-3 py-2">
            <span className="num w-5 text-center text-sm font-semibold">{i + 4}</span>
            <FaceAvatar seed={p.key + you} size={32} />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            <span className="num text-sm font-semibold">{p.score.toFixed(1)}%</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
