/**
 * An illustrated face for a person: the one they built at signup, or one drawn from their id
 * (the same id always gets the same face). Shaded skin, eyes with color and a shine, nose,
 * brows, many hair styles with highlights, facial hair, glasses and extras (earrings,
 * headphones, a cap). Pure SVG, no network, safe in server components.
 */
import { ACCESSORIES, AVATAR_BG, AVATAR_EYE_COLOR, AVATAR_HAIR, AVATAR_SHIRT, AVATAR_SKIN, avatarFromSeed, type AvatarConfig } from "@/lib/avatar";

/** Lighter (amt > 0) or darker (amt < 0) version of a #rrggbb color. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function idOf(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Colors and shapes of a face: a chosen avatar, or the one that comes from the seed. */
export function faceOf(seed: string, config?: AvatarConfig | null) {
  const c = config ?? avatarFromSeed(seed);
  return {
    ...c,
    facial: c.facial ?? (c.beard ? 3 : 0),
    accessory: Math.min(ACCESSORIES - 1, c.accessory ?? 0),
    bg: AVATAR_BG[c.bg] ?? AVATAR_BG[0],
    skin: AVATAR_SKIN[c.skin] ?? AVATAR_SKIN[0],
    hair: AVATAR_HAIR[c.hair] ?? AVATAR_HAIR[0],
    shirt: AVATAR_SHIRT[c.shirt] ?? AVATAR_SHIRT[0],
    iris: AVATAR_EYE_COLOR[c.eyeColor ?? 0] ?? AVATAR_EYE_COLOR[0],
  };
}

export function FaceAvatar({
  seed,
  config = null,
  size = 48,
  className = "",
  title,
}: {
  seed: string;
  /** The face the person chose; without one, the face comes from the seed. */
  config?: AvatarConfig | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const f = faceOf(seed, config);
  const id = `fa${idOf(JSON.stringify(f))}`;
  const skinDark = shade(f.skin, -0.18);
  const skinLight = shade(f.skin, 0.18);
  const hairLight = shade(f.hair, f.hair === AVATAR_HAIR[0] ? 0.28 : 0.22);
  const hairDark = shade(f.hair, -0.25);
  const lip = shade(f.skin, -0.38);
  const longBack = f.style === 2 || f.style === 8;
  const cap = f.accessory === 3;

  const eye = (cx: number) => {
    if (f.eyes === 1)
      return <path d={`M${cx - 4.5} 48.5 q4.5 -5 9 0`} stroke="#2b1d14" strokeWidth="2.4" fill="none" strokeLinecap="round" />;
    const ry = f.eyes === 2 ? 4.4 : 3.6;
    return (
      <g>
        <ellipse cx={cx} cy="47.5" rx="5" ry={ry} fill="#fff" />
        <circle cx={cx} cy="47.8" r={f.eyes === 2 ? 3.1 : 2.7} fill={f.iris} />
        <circle cx={cx} cy="47.8" r="1.4" fill="#120c08" />
        <circle cx={cx + 1} cy="46.6" r="0.9" fill="#fff" />
        <path d={`M${cx - 5} ${47.5 - ry + 0.6} q5 -2.6 10 0`} stroke="#2b1d14" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </g>
    );
  };

  const browColor = f.hair === AVATAR_HAIR[4] ? "#8b6a3a" : hairDark;
  const brow = f.brows === 1 ? "M35 39.5 h10 M55 39.5 h10" : f.brows === 2 ? "M34.5 40 q5.5 -4.5 11 -1 M54.5 39 q5.5 -3.5 11 1" : "M35.5 40 q5 -3 10 0 M54.5 40 q5 -3 10 0";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={shade(f.bg, 0.35)} />
          <stop offset="100%" stopColor={shade(f.bg, -0.08)} />
        </radialGradient>
        <radialGradient id={`${id}sk`} cx="45%" cy="38%" r="65%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="70%" stopColor={f.skin} />
          <stop offset="100%" stopColor={skinDark} />
        </radialGradient>
        <linearGradient id={`${id}hr`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hairLight} />
          <stop offset="100%" stopColor={hairDark} />
        </linearGradient>
        <linearGradient id={`${id}sh`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(f.shirt, 0.15)} />
          <stop offset="100%" stopColor={shade(f.shirt, -0.2)} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <circle cx="50" cy="50" r="50" fill={`url(#${id}bg)`} />
        <circle cx="82" cy="18" r="16" fill="#fff" opacity="0.18" />
        <circle cx="14" cy="80" r="10" fill="#fff" opacity="0.12" />

        {/* Long hair behind the head */}
        {longBack ? <path d="M23 46 Q19 84 30 96 L70 96 Q81 84 77 46 Z" fill={`url(#${id}hr)`} /> : null}

        {/* Body: shoulders, collar, neck */}
        <path d="M14 104 Q16 78 50 75 Q84 78 86 104 Z" fill={`url(#${id}sh)`} />
        <path d="M40 76 L50 88 L60 76" fill={skinDark} />
        <path d="M38 76.5 L50 89 L62 76.5" fill="none" stroke={shade(f.shirt, -0.3)} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M43 60 h14 v14 q-7 5 -14 0 Z" fill={skinDark} />

        {/* Ears */}
        <ellipse cx="28" cy="50" rx="4.2" ry="6" fill={f.skin} />
        <ellipse cx="72" cy="50" rx="4.2" ry="6" fill={f.skin} />
        <path d="M27.5 47 q-1.8 3 0 6" stroke={skinDark} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M72.5 47 q1.8 3 0 6" stroke={skinDark} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {f.accessory === 1 ? (
          <g fill="#e5b93a" stroke="#a8811c" strokeWidth="0.6">
            <circle cx="27.5" cy="57" r="2" />
            <circle cx="72.5" cy="57" r="2" />
          </g>
        ) : null}

        {/* Head */}
        <path d="M28 46 Q28 22 50 22 Q72 22 72 46 Q72 66 60 71 Q50 75 40 71 Q28 66 28 46 Z" fill={`url(#${id}sk)`} />

        {/* Facial hair under the hair line */}
        {f.facial === 1 ? <path d="M31 55 Q33 70 50 72.5 Q67 70 69 55 Q66 64 50 65 Q34 64 31 55 Z" fill={hairDark} opacity="0.28" /> : null}
        {f.facial === 3 ? (
          <path d="M29.5 50 Q30 72 50 76 Q70 72 70.5 50 Q68 60 62 62 Q56 59 50 60 Q44 59 38 62 Q32 60 29.5 50 Z" fill={`url(#${id}hr)`} />
        ) : null}

        {/* Hair */}
        {f.style === 0 ? <path d="M27 46 Q25 19 50 18 Q75 19 73 46 Q70 33 60 29 Q50 33 40 29 Q30 33 27 46 Z" fill={`url(#${id}hr)`} /> : null}
        {f.style === 1 ? <path d="M29 40 Q31 21 50 21 Q69 21 71 40 Q63 29 50 29 Q37 29 29 40 Z" fill={`url(#${id}hr)`} opacity="0.92" /> : null}
        {f.style === 2 ? <path d="M26 52 Q22 19 50 17 Q78 19 74 52 Q72 32 58 27 Q46 37 26 52 Z" fill={`url(#${id}hr)`} /> : null}
        {f.style === 3 ? (
          <>
            <circle cx="50" cy="14" r="9.5" fill={`url(#${id}hr)`} />
            <path d="M27 45 Q26 21 50 20 Q74 21 73 45 Q66 29 50 28 Q34 29 27 45 Z" fill={`url(#${id}hr)`} />
          </>
        ) : null}
        {f.style === 4 ? (
          <g fill={`url(#${id}hr)`}>
            {[
              [29, 40, 8],
              [34, 29, 8.5],
              [43, 23, 9],
              [54, 22, 9],
              [64, 27, 8.5],
              [71, 38, 8],
            ].map(([x, y, r]) => (
              <circle key={x} cx={x} cy={y} r={r} />
            ))}
          </g>
        ) : null}
        {f.style === 6 ? <path d="M27 46 Q24 18 52 18 Q76 20 73 44 Q70 30 58 28 Q44 26 36 34 Q30 38 27 46 Z" fill={`url(#${id}hr)`} /> : null}
        {f.style === 7 ? <path d="M43 34 Q44 12 50 10 Q56 12 57 34 Q50 30 43 34 Z" fill={`url(#${id}hr)`} /> : null}
        {f.style === 7 ? <path d="M30 40 Q34 30 43 31 L43 34 Q35 35 30 40 Z M70 40 Q66 30 57 31 L57 34 Q65 35 70 40 Z" fill={hairDark} opacity="0.35" /> : null}
        {f.style === 8 ? (
          <path d="M25 54 Q21 20 50 17 Q79 20 75 54 Q73 40 66 34 Q62 30 56 31 Q48 36 40 32 Q32 36 28 44 Q26 48 25 54 Z" fill={`url(#${id}hr)`} />
        ) : null}
        {/* Highlight on the hair */}
        {[0, 2, 3, 6, 8].includes(f.style) ? <path d="M36 25 Q46 20 58 22" stroke={shade(f.hair, 0.45)} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" /> : null}

        {/* Cap */}
        {cap ? (
          <g>
            <path d="M26 40 Q26 16 50 16 Q74 16 74 40 Z" fill={shade(f.shirt, 0.05)} />
            <path d="M24 40 Q50 34 80 41 Q82 45 76 45 Q50 40 26 44 Z" fill={shade(f.shirt, -0.25)} />
            <circle cx="50" cy="17" r="2" fill={shade(f.shirt, -0.3)} />
            <path d="M38 22 Q46 18 56 19" stroke="#fff" strokeWidth="1.6" fill="none" opacity="0.35" strokeLinecap="round" />
          </g>
        ) : null}

        {/* Brows, eyes, nose */}
        <path d={brow} stroke={browColor} strokeWidth={f.brows === 2 ? 3 : 2.2} fill="none" strokeLinecap="round" />
        {eye(40.5)}
        {eye(59.5)}
        <path d="M50 49 q-2.6 6 0.4 7.4 q1.6 0.6 3 -0.4" stroke={skinDark} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {f.cheeks ? (
          <g fill="#f87171" opacity="0.28">
            <ellipse cx="34.5" cy="57" rx="4.5" ry="3" />
            <ellipse cx="65.5" cy="57" rx="4.5" ry="3" />
          </g>
        ) : null}

        {/* Mouth */}
        {f.mouth === 0 ? (
          <g>
            <path d="M42.5 60.5 Q50 67.5 57.5 60.5 Q50 63 42.5 60.5 Z" fill="#fff" />
            <path d="M42.5 60.5 Q50 67.5 57.5 60.5" stroke={lip} strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        ) : null}
        {f.mouth === 1 ? (
          <g>
            <path d="M41.5 59.5 Q50 71 58.5 59.5 Z" fill="#7f1d1d" />
            <path d="M42.5 60 Q50 62 57.5 60 L57 61.5 Q50 63.2 43 61.5 Z" fill="#fff" />
            <path d="M45 66.5 Q50 63.5 55 66.5 Q50 69 45 66.5 Z" fill="#f87171" />
          </g>
        ) : null}
        {f.mouth === 2 ? <path d="M44 62 q6 2.4 12 0" stroke={lip} strokeWidth="2.2" fill="none" strokeLinecap="round" /> : null}
        {f.mouth === 3 ? <path d="M44 62.5 q7 1.5 12 -2.5" stroke={lip} strokeWidth="2.2" fill="none" strokeLinecap="round" /> : null}

        {/* Mustache over the mouth */}
        {f.facial === 2 || f.facial === 3 ? (
          <path d="M41 59 Q45 55.5 50 58 Q55 55.5 59 59 Q55 58.6 50 60 Q45 58.6 41 59 Z" fill={hairDark} />
        ) : null}

        {/* Glasses */}
        {f.glasses ? (
          <g>
            <rect x="32.5" y="41.5" width="15" height="12" rx="5" fill="#bae6fd" opacity="0.22" stroke="#1f1a17" strokeWidth="1.8" />
            <rect x="52.5" y="41.5" width="15" height="12" rx="5" fill="#bae6fd" opacity="0.22" stroke="#1f1a17" strokeWidth="1.8" />
            <path d="M47.5 46 q2.5 -1.6 5 0 M32.5 45 L29 44 M67.5 45 L71 44" stroke="#1f1a17" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M35 44 l3 -1.5" stroke="#fff" strokeWidth="1" opacity="0.8" strokeLinecap="round" />
          </g>
        ) : null}

        {/* Headphones */}
        {f.accessory === 2 ? (
          <g>
            <path d="M25 50 Q23 13 50 13 Q77 13 75 50" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
            <rect x="20" y="43" width="9" height="15" rx="4" fill="#111827" />
            <rect x="71" y="43" width="9" height="15" rx="4" fill="#111827" />
            <rect x="21.5" y="45" width="3" height="11" rx="1.5" fill={shade(f.shirt, 0.25)} />
            <rect x="75.5" y="45" width="3" height="11" rx="1.5" fill={shade(f.shirt, 0.25)} />
          </g>
        ) : null}
      </g>
    </svg>
  );
}

/** Face with the name under it, for leaderboards and member lists. */
export function FaceWithName({
  seed,
  config = null,
  name,
  size = 56,
  note,
  highlight = false,
}: {
  seed: string;
  config?: AvatarConfig | null;
  name: string;
  size?: number;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <span className="flex w-[4.75rem] flex-col items-center gap-1 text-center">
      <FaceAvatar seed={seed} config={config} size={size} className={highlight ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""} />
      <span className="line-clamp-1 w-full text-xs font-medium">{name}</span>
      {note ? <span className="num text-[11px] text-ink-muted">{note}</span> : null}
    </span>
  );
}
