"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";
import { completeOnboarding, saveOnboardingDraft } from "@/lib/onboarding/actions";
import {
  ACTIVITY_LEVELS,
  ALLERGENS,
  DAYS,
  DIETARY_PATTERNS,
  EQUIPMENT,
  EXPERIENCE,
  GOAL_TYPES,
  LOCATIONS,
  MIN_AGE,
  SAFETY_QUESTIONS,
  STEP_ORDER,
  stepErrors,
  type OnboardingDraft,
  type StepKey,
} from "@/lib/onboarding/schema";
import { allowedGoals, screenSafety } from "@/lib/safety/screen";
import { ChipGroup, ListField, NumberField, TextField, YesNo } from "./fields";

const t = getDictionary();
const s = t.screens.onboarding;
const f = s.fields;
const o = s.options;

type SaveStatus = "idle" | "saving" | "saved" | "error";
const SUMMARY = STEP_ORDER.length;

function opts<T extends string>(keys: readonly T[], labels: Record<T, string>) {
  return keys.map((k) => ({ value: k, label: labels[k] }));
}
const dayOpts = DAYS.map((d) => ({ value: d as number, label: o.days[d] }));

export function Questionnaire({ initial, initialStep }: { initial: OnboardingDraft; initialStep: number }) {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(Math.min(initialStep, SUMMARY));
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [completeError, setCompleteError] = useState(false);
  const [pending, startTransition] = useTransition();
  const firstRender = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Debounced autosave on every change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus("saving");
    const id = setTimeout(async () => {
      try {
        const r = await saveOnboardingDraft(draft, step);
        setStatus(r.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    }, 700);
    return () => clearTimeout(id);
  }, [draft, step]);

  // Move focus to the step heading for screen-reader and keyboard users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const key: StepKey | null = step < SUMMARY ? STEP_ORDER[step] : null;
  const errors = key && showErrors ? stepErrors(key, draft) : [];
  const bad = (field: string) => errors.includes(field);
  const underage = draft.age !== null && draft.age < MIN_AGE;

  function next() {
    if (key && stepErrors(key, draft).length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((n) => Math.min(n + 1, SUMMARY));
    window.scrollTo({ top: 0 });
  }
  function back() {
    setShowErrors(false);
    setStep((n) => Math.max(n - 1, 0));
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            {key
              ? s.stepOf.replace("{n}", String(step + 1)).replace("{total}", String(SUMMARY))
              : s.summaryTitle}
          </span>
          <SaveIndicator status={status} />
        </div>
        <div
          role="progressbar"
          aria-label={s.title}
          aria-valuemin={0}
          aria-valuemax={SUMMARY}
          aria-valuenow={step}
          className="flex gap-1.5"
        >
          {STEP_ORDER.map((k, i) => (
            <span key={k} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-night" : i === step ? "bg-accent" : "bg-white"}`} />
          ))}
        </div>
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
        {key ? s.steps[key] : s.summaryTitle}
      </h2>

      {showErrors && errors.length > 0 ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {underage && key === "details" ? t.auth.ageNote : s.fixFields}
        </p>
      ) : null}

      {key === "details" && (
        <Card className="flex flex-col gap-5">
          <TextField label={f.display_name} value={draft.display_name} maxLength={40} invalid={bad("display_name")} onChange={(v) => set("display_name", v)} />
          <NumberField label={f.age} value={draft.age} min={MIN_AGE} max={100} invalid={bad("age")} hint={t.auth.ageNote} onChange={(v) => set("age", v)} />
          <div className="grid grid-cols-2 gap-4">
            <NumberField label={f.height_cm} value={draft.height_cm} min={120} max={230} invalid={bad("height_cm")} onChange={(v) => set("height_cm", v)} />
            <NumberField label={f.weight_kg} value={draft.weight_kg} min={35} max={300} step={0.1} invalid={bad("weight_kg")} onChange={(v) => set("weight_kg", v)} />
          </div>
          <NumberField label={`${f.target_weight_kg} ${s.optional}`} value={draft.target_weight_kg} min={35} max={300} step={0.1} invalid={bad("target_weight_kg")} onChange={(v) => set("target_weight_kg", v)} />
        </Card>
      )}

      {key === "goals" && (
        <Card>
          <ChipGroup label={f.goals} options={opts(GOAL_TYPES, o.goals)} value={draft.goals} multiple max={3} invalid={bad("goals")} onChange={(v) => set("goals", v)} />
        </Card>
      )}

      {key === "nutrition" && (
        <Card className="flex flex-col gap-5">
          <ChipGroup label={f.dietary_pattern} options={opts(DIETARY_PATTERNS, o.dietary_pattern)} value={draft.dietary_pattern ? [draft.dietary_pattern] : []} invalid={bad("dietary_pattern")} onChange={(v) => set("dietary_pattern", v[0] ?? null)} />
          <ChipGroup label={`${f.allergies} ${s.optional}`} options={opts(ALLERGENS, o.allergies)} value={draft.allergies} multiple onChange={(v) => set("allergies", v)} />
          <ListField label={`${f.sensitivities} ${s.optional}`} hint={f.listHint} value={draft.sensitivities} onChange={(v) => set("sensitivities", v)} />
          <ListField label={`${f.likes} ${s.optional}`} hint={f.listHint} value={draft.likes} onChange={(v) => set("likes", v)} />
          <ListField label={`${f.dislikes} ${s.optional}`} hint={f.listHint} value={draft.dislikes} onChange={(v) => set("dislikes", v)} />
          <div className="grid grid-cols-2 gap-4">
            <NumberField label={f.meals_per_day} value={draft.meals_per_day} min={1} max={6} invalid={bad("meals_per_day")} onChange={(v) => set("meals_per_day", v)} />
            <NumberField label={f.cooking_minutes} value={draft.cooking_minutes} min={0} max={120} invalid={bad("cooking_minutes")} onChange={(v) => set("cooking_minutes", v)} />
          </div>
        </Card>
      )}

      {key === "fitness" && (
        <Card className="flex flex-col gap-5">
          <ChipGroup label={f.experience} options={opts(EXPERIENCE, o.experience)} value={draft.experience ? [draft.experience] : []} invalid={bad("experience")} onChange={(v) => set("experience", v[0] ?? null)} />
          <ChipGroup label={f.location} options={opts(LOCATIONS, o.location)} value={draft.location} multiple invalid={bad("location")} onChange={(v) => set("location", v)} />
          <ChipGroup label={`${f.equipment} ${s.optional}`} options={opts(EQUIPMENT, o.equipment)} value={draft.equipment} multiple onChange={(v) => set("equipment", v)} />
          <ChipGroup label={f.available_days} options={dayOpts} value={draft.available_days} multiple invalid={bad("available_days")} onChange={(v) => set("available_days", [...v].sort())} />
          <NumberField label={f.session_minutes} value={draft.session_minutes} min={10} max={120} step={5} invalid={bad("session_minutes")} onChange={(v) => set("session_minutes", v)} />
        </Card>
      )}

      {key === "safety" && (
        <Card className="flex flex-col gap-5">
          <p className="text-ink-muted">{f.safetyIntro}</p>
          {SAFETY_QUESTIONS.map((q) => (
            <YesNo
              key={q}
              label={s.safetyQuestions[q]}
              value={draft.answers[q]}
              yes={s.yes}
              no={s.no}
              invalid={bad("answers") && draft.answers[q] === null}
              onChange={(v) => set("answers", { ...draft.answers, [q]: v })}
            />
          ))}
          <TextField label={`${f.limitations} ${s.optional}`} placeholder={f.limitationsHint} value={draft.limitations} multiline maxLength={500} onChange={(v) => set("limitations", v)} />
        </Card>
      )}

      {key === "lifestyle" && (
        <Card className="flex flex-col gap-5">
          <ChipGroup label={f.activity_level} options={opts(ACTIVITY_LEVELS, o.activity_level)} value={draft.activity_level ? [draft.activity_level] : []} invalid={bad("activity_level")} onChange={(v) => set("activity_level", v[0] ?? null)} />
          <div className="grid grid-cols-2 gap-4">
            <NumberField label={f.sleep_hours} value={draft.sleep_hours} min={3} max={14} step={0.5} invalid={bad("sleep_hours")} onChange={(v) => set("sleep_hours", v)} />
            <NumberField label={f.water_cups_now} value={draft.water_cups_now} min={0} max={20} invalid={bad("water_cups_now")} onChange={(v) => set("water_cups_now", v)} />
          </div>
          <ChipGroup label={`${f.busy_days} ${s.optional}`} options={dayOpts} value={draft.busy_days} multiple onChange={(v) => set("busy_days", [...v].sort())} />
        </Card>
      )}

      {step === SUMMARY && <Summary draft={draft} onEdit={(i) => setStep(i)} />}

      {completeError ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {t.common.errorBody}
        </p>
      ) : null}

      {/* Navigation */}
      <div className="sticky bottom-0 -mx-4 flex gap-3 bg-gradient-to-t from-canvas via-canvas/95 to-canvas/0 px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {step > 0 ? (
          <Button variant="secondary" onClick={back} className="flex-1">
            {s.back}
          </Button>
        ) : null}
        {step < SUMMARY ? (
          <Button onClick={next} className="flex-[2]">
            {step === SUMMARY - 1 ? s.finish : s.next}
          </Button>
        ) : (
          <Button
            className="flex-[2]"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setCompleteError(false);
                const r = await completeOnboarding(draft);
                if (r && !r.ok) setCompleteError(true);
              })
            }
          >
            {pending ? t.common.loading : s.confirm}
          </Button>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span role="status" className={`flex items-center gap-1 ${status === "error" ? "text-danger" : ""}`}>
      {status === "saved" ? <Check aria-hidden="true" className="size-4" /> : null}
      {status === "saving" ? s.saving : status === "saved" ? s.saved : s.saveError}
    </span>
  );
}

function Summary({ draft, onEdit }: { draft: OnboardingDraft; onEdit: (step: number) => void }) {
  const safety = screenSafety(draft);
  const goals = allowedGoals(draft.goals, safety);
  const list = (xs: string[]) => (xs.length ? xs.join(", ") : "—");
  const rows: { step: StepKey; items: [string, string][] }[] = [
    {
      step: "details",
      items: [
        [f.display_name, draft.display_name],
        [f.age, String(draft.age ?? "—")],
        [f.height_cm, String(draft.height_cm ?? "—")],
        [f.weight_kg, String(draft.weight_kg ?? "—")],
        [f.target_weight_kg, String(draft.target_weight_kg ?? "—")],
      ],
    },
    { step: "goals", items: [[f.goals, list(goals.map((g) => o.goals[g]))]] },
    {
      step: "nutrition",
      items: [
        [f.dietary_pattern, draft.dietary_pattern ? o.dietary_pattern[draft.dietary_pattern] : "—"],
        [f.allergies, list(draft.allergies.map((a) => o.allergies[a]))],
        [f.dislikes, list(draft.dislikes)],
        [f.meals_per_day, String(draft.meals_per_day ?? "—")],
      ],
    },
    {
      step: "fitness",
      items: [
        [f.experience, draft.experience ? o.experience[draft.experience] : "—"],
        [f.location, list(draft.location.map((l) => o.location[l]))],
        [f.equipment, list(draft.equipment.map((e) => o.equipment[e]))],
        [f.available_days, list(draft.available_days.map((d) => o.days[d]))],
        [f.session_minutes, String(draft.session_minutes ?? "—")],
      ],
    },
    {
      step: "lifestyle",
      items: [
        [f.activity_level, draft.activity_level ? o.activity_level[draft.activity_level] : "—"],
        [f.sleep_hours, String(draft.sleep_hours ?? "—")],
        [f.water_cups_now, String(draft.water_cups_now ?? "—")],
      ],
    },
  ];

  const tone =
    safety.level === "refer"
      ? { Icon: ShieldAlert, cls: "border-danger/30 bg-danger-soft", title: t.safety.referTitle, body: t.safety.referBody }
      : safety.level === "caution"
        ? { Icon: AlertTriangle, cls: "border-warning/30 bg-warning-soft", title: t.safety.cautionTitle, body: t.safety.cautionBody }
        : { Icon: CheckCircle2, cls: "bg-accent-soft", title: t.safety.clearTitle, body: t.safety.clearBody };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted">{s.summaryBody}</p>
      <Card className={`flex flex-col gap-2 ${tone.cls}`} role={safety.level === "clear" ? undefined : "alert"}>
        <div className="flex items-center gap-2 font-bold">
          <tone.Icon aria-hidden="true" className="size-5" />
          {tone.title}
        </div>
        <p className="text-sm">{tone.body}</p>
        {safety.reasons.length ? (
          <ul className="list-disc ps-5 text-sm">
            {safety.reasons.map((r) => (
              <li key={r}>{t.safety.reasons[r]}</li>
            ))}
          </ul>
        ) : null}
        <button type="button" onClick={() => onEdit(STEP_ORDER.indexOf("safety"))} className="self-start text-sm font-medium text-brand underline">
          {s.edit}
        </button>
      </Card>
      {rows.map((section) => (
        <Card key={section.step} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{s.steps[section.step]}</h3>
            <button type="button" onClick={() => onEdit(STEP_ORDER.indexOf(section.step))} className="text-sm font-medium text-brand underline">
              {s.edit}
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {section.items.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
      <p className="text-sm text-ink-muted">{s.confirmNote}</p>
    </div>
  );
}
