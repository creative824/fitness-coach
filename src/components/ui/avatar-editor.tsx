"use client";

import { Dices } from "lucide-react";
import type { ReactNode } from "react";
import { AVATAR_BG, AVATAR_HAIR, AVATAR_SHIRT, AVATAR_SKIN, EYE_STYLES, HAIR_STYLES, MOUTH_STYLES, avatarFromSeed, type AvatarConfig } from "@/lib/avatar";
import { FaceAvatar } from "./face-avatar";

const HAIR_STYLE_LABEL = ["קצר", "קצוץ", "ארוך", "קוקו", "מתולתל", "בלי"];
const EYE_LABEL = ["נקודות", "מחייכות", "גדולות"];
const MOUTH_LABEL = ["חיוך", "צחוק", "רגוע"];

/**
 * Build your own face: a big preview, then rows of choices (skin, hair, eyes, smile, extras,
 * colors). "Surprise me" draws a random face to start from.
 */
export function AvatarEditor({ value, onChange, name }: { value: AvatarConfig; onChange: (v: AvatarConfig) => void; name?: string }) {
  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => onChange({ ...value, [k]: v });
  const preview = (patch: Partial<AvatarConfig>) => ({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <FaceAvatar seed="me" config={value} size={96} className="shadow-[var(--shadow-card)]" />
        <div className="flex flex-col gap-2">
          {name ? <span className="text-lg font-semibold">{name}</span> : null}
          <span className="text-sm text-ink-muted">כך יראו אותך בתחרויות ובמסך הבית.</span>
          <button
            type="button"
            onClick={() => onChange(avatarFromSeed(String(Math.random())))}
            className="inline-flex w-fit min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-field px-3 text-sm font-medium hover:bg-line/60"
          >
            <Dices aria-hidden="true" className="size-4" />
            הפתיעו אותי
          </button>
        </div>
      </div>

      <Row label="צבע עור">
        {AVATAR_SKIN.map((c, i) => (
          <Swatch key={c} color={c} label={`גוון ${i + 1}`} on={value.skin === i} onClick={() => set("skin", i)} />
        ))}
      </Row>

      <Row label="תסרוקת">
        {Array.from({ length: HAIR_STYLES }, (_, i) => (
          <FaceChoice key={i} label={HAIR_STYLE_LABEL[i]} on={value.style === i} config={preview({ style: i })} onClick={() => set("style", i)} />
        ))}
      </Row>

      <Row label="צבע שיער">
        {AVATAR_HAIR.map((c, i) => (
          <Swatch key={c} color={c} label={`צבע ${i + 1}`} on={value.hair === i} onClick={() => set("hair", i)} />
        ))}
      </Row>

      <Row label="עיניים">
        {Array.from({ length: EYE_STYLES }, (_, i) => (
          <FaceChoice key={i} label={EYE_LABEL[i]} on={value.eyes === i} config={preview({ eyes: i })} onClick={() => set("eyes", i)} />
        ))}
      </Row>

      <Row label="פה">
        {Array.from({ length: MOUTH_STYLES }, (_, i) => (
          <FaceChoice key={i} label={MOUTH_LABEL[i]} on={value.mouth === i} config={preview({ mouth: i })} onClick={() => set("mouth", i)} />
        ))}
      </Row>

      <Row label="תוספות">
        <Toggle label="משקפיים" on={value.glasses} onClick={() => set("glasses", !value.glasses)} />
        <Toggle label="זקן" on={value.beard} onClick={() => set("beard", !value.beard)} />
        <Toggle label="לחיים ורודות" on={value.cheeks} onClick={() => set("cheeks", !value.cheeks)} />
      </Row>

      <Row label="חולצה">
        {AVATAR_SHIRT.map((c, i) => (
          <Swatch key={c} color={c} label={`חולצה ${i + 1}`} on={value.shirt === i} onClick={() => set("shirt", i)} />
        ))}
      </Row>

      <Row label="רקע">
        {AVATAR_BG.map((c, i) => (
          <Swatch key={c} color={c} label={`רקע ${i + 1}`} on={value.bg === i} onClick={() => set("bg", i)} />
        ))}
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Swatch({ color, label, on, onClick }: { color: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`size-9 cursor-pointer rounded-full ring-offset-2 ring-offset-surface transition-shadow ${on ? "scale-110 ring-[3px] ring-brand" : "ring-1 ring-ink/10 hover:ring-ink/40"}`}
      style={{ backgroundColor: color }}
    />
  );
}

function FaceChoice({ label, on, config, onClick }: { label: string; on: boolean; config: AvatarConfig; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl p-1.5 text-xs transition-colors ${on ? "bg-accent-soft ring-2 ring-accent" : "bg-field hover:bg-line/60"}`}
    >
      <FaceAvatar seed="choice" config={config} size={44} />
      {label}
    </button>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-9 cursor-pointer rounded-full px-3.5 text-sm transition-colors ${on ? "bg-brand text-white" : "bg-field hover:bg-line/60"}`}
    >
      {label}
    </button>
  );
}
