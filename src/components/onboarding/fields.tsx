"use client";

import { useId, useState, type ReactNode } from "react";

/** Small accessible form controls for the questionnaire. */

export function FieldShell({
  label,
  hint,
  invalid,
  children,
  htmlFor,
  asGroup,
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  children: ReactNode;
  htmlFor?: string;
  asGroup?: boolean;
}) {
  const hintId = useId();
  const labelEl = asGroup ? (
    <legend className="mb-2 text-sm font-medium">{label}</legend>
  ) : (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {label}
    </label>
  );
  const body = (
    <>
      {labelEl}
      {children}
      {hint ? (
        <span id={hintId} className="text-sm text-ink-muted">
          {hint}
        </span>
      ) : null}
    </>
  );
  // Groups get a red outline; single inputs show it on their own border (aria-invalid).
  const cls = `flex flex-col gap-1.5 rounded-2xl ${invalid && asGroup ? "outline-2 outline-offset-4 outline-danger outline" : ""}`;
  return asGroup ? (
    <fieldset className={cls} aria-invalid={invalid || undefined}>
      {body}
    </fieldset>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const inputCls =
  "min-h-13 w-full rounded-2xl border border-transparent bg-field px-4 text-base text-ink transition-colors hover:border-line focus:border-ink focus:bg-surface focus:outline-none aria-invalid:border-2 aria-invalid:border-danger";

export function TextField({
  label,
  value,
  onChange,
  invalid,
  hint,
  multiline,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} invalid={invalid} htmlFor={id}>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${inputCls} py-3`}
        />
      ) : (
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
    </FieldShell>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  invalid,
  hint,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  invalid?: boolean;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} invalid={invalid} htmlFor={id}>
      <input
        id={id}
        type="number"
        inputMode={step < 1 ? "decimal" : "numeric"}
        dir="ltr"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = Number(raw);
          onChange(Number.isFinite(n) ? (step < 1 ? n : Math.round(n)) : null);
        }}
        className={`${inputCls} text-end`}
      />
    </FieldShell>
  );
}

/** Toggle chips. `multiple` = checkbox semantics, otherwise radio semantics. */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  multiple,
  max,
  invalid,
  hint,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multiple?: boolean;
  max?: number;
  invalid?: boolean;
  hint?: string;
}) {
  return (
    <FieldShell label={label} hint={hint} invalid={invalid} asGroup>
      <div role={multiple ? "group" : "radiogroup"} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value.includes(o.value);
          const atMax = multiple && max !== undefined && value.length >= max && !selected;
          return (
            <button
              key={String(o.value)}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={selected}
              disabled={atMax}
              onClick={() => {
                if (!multiple) return onChange([o.value]);
                onChange(selected ? value.filter((v) => v !== o.value) : [...value, o.value]);
              }}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-40 ${
                selected ? "border-night bg-night text-white shadow-[0_6px_16px_-8px_rgba(18,21,19,0.6)]" : "border-transparent bg-field text-ink hover:border-line"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}

export function YesNo({
  label,
  value,
  onChange,
  yes,
  no,
  invalid,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  yes: string;
  no: string;
  invalid?: boolean;
}) {
  return (
    <FieldShell label={label} invalid={invalid} asGroup>
      <div role="radiogroup" className="flex gap-2">
        {[
          { v: false, l: no },
          { v: true, l: yes },
        ].map(({ v, l }) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`min-h-11 min-w-20 rounded-full border px-5 text-sm font-medium ${
              value === v
                ? v
                  ? "border-warning bg-warning-soft text-warning"
                  : "border-night bg-night text-white"
                : "border-transparent bg-field hover:border-line"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </FieldShell>
  );
}

/** Free-text list typed as comma-separated values. */
export function ListField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <TextField
      label={label}
      hint={hint}
      value={text}
      maxLength={400}
      onChange={(v) => {
        setText(v);
        onChange(
          v
            .split(/[,،\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 20)
            .map((s) => s.slice(0, 40)),
        );
      }}
    />
  );
}
