"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MUSCLES } from "@/content/muscles";
import { updateExercise, type ExerciseFormState } from "@/lib/admin/actions";
import type { ExerciseRow } from "@/lib/admin/content";
import { getDictionary } from "@/lib/i18n/he";
import { EQUIPMENT } from "@/lib/onboarding/schema";

const t = getDictionary();
const a = t.admin.exercise;
const o = t.screens.onboarding.options;
const inputCls = "min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base";

function Checks({ name, legend, options, checked }: { name: string; legend: string; options: { value: string; label: string }[]; checked: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((op) => (
          <label key={op.value} className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
            <input type="checkbox" name={name} value={op.value} defaultChecked={checked.includes(op.value)} className="size-4 accent-brand" />
            {op.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Record<string, string> }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      <select name={name} defaultValue={value} className={inputCls}>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExerciseForm({ exercise }: { exercise: ExerciseRow }) {
  const [state, action, pending] = useActionState<ExerciseFormState, FormData>(updateExercise.bind(null, exercise.id), undefined);
  const muscles = MUSCLES.map((m) => ({ value: m.id, label: m.name_he }));
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {t.common.errorTitle}: {state.error}
        </p>
      ) : null}
      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">{a.name}</span>
          <input name="name_he" defaultValue={exercise.name_he} required maxLength={80} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">{a.instructions}</span>
          <textarea name="instructions_he" defaultValue={exercise.instructions_he} rows={5} required className={`${inputCls} py-3`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">{a.cautions}</span>
          <textarea name="cautions_he" defaultValue={exercise.cautions_he ?? ""} rows={2} className={`${inputCls} py-3`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select name="category" label={a.category} value={exercise.category} options={a.categories} />
          <Select name="difficulty" label={a.difficulty} value={exercise.difficulty} options={o.experience} />
          <Select name="mode" label={a.mode} value={exercise.mode} options={a.modes} />
        </div>
      </Card>
      <Card className="flex flex-col gap-5">
        <Checks name="primary_muscles" legend={a.primary} options={muscles} checked={exercise.primary_muscles} />
        <Checks name="secondary_muscles" legend={a.secondary} options={muscles} checked={exercise.secondary_muscles} />
        <Checks
          name="equipment"
          legend={a.equipment}
          options={EQUIPMENT.filter((q) => q !== "none").map((q) => ({ value: q, label: o.equipment[q] }))}
          checked={exercise.equipment}
        />
        <Checks
          name="contraindications"
          legend={a.contraindications}
          options={Object.entries(a.contras).map(([value, label]) => ({ value, label }))}
          checked={exercise.contraindications}
        />
      </Card>
      <p className="text-sm text-ink-muted">{t.admin.reviewNote}</p>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : t.admin.save}
        </Button>
        <Link href="/admin/exercises" className="inline-flex min-h-12 items-center px-4 text-brand underline">
          {t.admin.cancel}
        </Link>
      </div>
    </form>
  );
}
