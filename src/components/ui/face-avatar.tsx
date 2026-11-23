/**
 * An illustrated face for a person without a photo, drawn from their id: the same person always
 * gets the same face (skin tone, hair, eyes, smile, sometimes glasses or a beard), and different
 * people look different. Pure SVG, no network.
 */

const BG = ["#d9f99d", "#bae6fd", "#fecdd3", "#ddd6fe", "#fde68a", "#a7f3d0", "#fed7aa", "#c7d2fe"];
const SKIN = ["#f8d5b8", "#eab68f", "#d39a6a", "#b87a4b", "#8d5a35", "#5e3a22"];
const SHIRT = ["#334155", "#0f766e", "#6d28d9", "#be123c", "#1d4ed8", "#a16207"];
const HAIR = ["#1f1a17", "#3b2a20", "#6b4226", "#a0522d", "#d6a756", "#8a8a8a"];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Picks from `n` options with a different slice of the hash each time. */
function picker(seed: string) {
  let h = hash(seed);
  return (n: number) => {
    const v = h % n;
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    return v;
  };
}

export function faceOf(seed: string) {
  const pick = picker(seed);
  return {
    bg: BG[pick(BG.length)],
    skin: SKIN[pick(SKIN.length)],
    hair: HAIR[pick(HAIR.length)],
    style: pick(6),
    eyes: pick(3),
    mouth: pick(3),
    glasses: pick(5) === 0,
    beard: pick(5) === 0,
    cheeks: pick(2) === 0,
    shirt: SHIRT[pick(SHIRT.length)],
  };
}

export function FaceAvatar({ seed, size = 48, className = "", title }: { seed: string; size?: number; className?: string; title?: string }) {
  const f = faceOf(seed);
  const eye = (cx: number) =>
    f.eyes === 0 ? (
      <circle cx={cx} cy="47" r="3" fill="#1f1a17" />
    ) : f.eyes === 1 ? (
      <path d={`M${cx - 4} 48 q4 -5 8 0`} stroke="#1f1a17" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    ) : (
      <ellipse cx={cx} cy="47" rx="2.6" ry="3.6" fill="#1f1a17" />
    );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`shrink-0 rounded-full ${className}`} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="50" cy="50" r="50" fill={f.bg} />
      {/* Long hair behind the head */}
      {f.style === 2 ? <path d="M22 50 Q20 88 34 92 L66 92 Q80 88 78 50 Z" fill={f.hair} /> : null}
      {/* Shoulders */}
      <path d="M18 100 Q22 76 50 74 Q78 76 82 100 Z" fill={f.shirt} />
      <rect x="43" y="62" width="14" height="14" rx="5" fill={f.skin} />
      {/* Head */}
      <ellipse cx="50" cy="48" rx="22" ry="24" fill={f.skin} />
      <ellipse cx="28" cy="50" rx="3.5" ry="5" fill={f.skin} />
      <ellipse cx="72" cy="50" rx="3.5" ry="5" fill={f.skin} />
      {/* Hair */}
      {f.style === 0 ? <path d="M28 44 Q27 22 50 21 Q73 22 72 44 Q66 32 50 31 Q34 32 28 44 Z" fill={f.hair} /> : null}
      {f.style === 1 ? <path d="M29 40 Q32 23 50 23 Q68 23 71 40 Q62 31 50 31 Q38 31 29 40 Z" fill={f.hair} opacity="0.85" /> : null}
      {f.style === 2 ? <path d="M27 50 Q24 22 50 20 Q76 22 73 50 Q70 34 56 30 Q44 38 27 50 Z" fill={f.hair} /> : null}
      {f.style === 3 ? (
        <>
          <circle cx="50" cy="17" r="9" fill={f.hair} />
          <path d="M28 44 Q28 23 50 23 Q72 23 72 44 Q64 30 50 30 Q36 30 28 44 Z" fill={f.hair} />
        </>
      ) : null}
      {f.style === 4 ? (
        <g fill={f.hair}>
          {[30, 38, 46, 54, 62, 70].map((x) => (
            <circle key={x} cx={x} cy={x === 30 || x === 70 ? 36 : 27} r="8" />
          ))}
        </g>
      ) : null}
      {/* style 5: no hair */}
      {/* Brows */}
      <path d="M36 40 q5 -3 10 0 M54 40 q5 -3 10 0" stroke={f.hair === HAIR[4] ? "#8b6a3a" : f.hair} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {eye(41)}
      {eye(59)}
      {f.glasses ? (
        <g stroke="#1f1a17" strokeWidth="1.8" fill="none">
          <circle cx="41" cy="47" r="7" />
          <circle cx="59" cy="47" r="7" />
          <path d="M48 47 h4" />
        </g>
      ) : null}
      {f.cheeks ? (
        <g fill="#f87171" opacity="0.25">
          <circle cx="35" cy="56" r="4" />
          <circle cx="65" cy="56" r="4" />
        </g>
      ) : null}
      {f.beard ? <path d="M30 54 Q32 74 50 75 Q68 74 70 54 Q64 66 50 66 Q36 66 30 54 Z" fill={f.hair} opacity="0.9" /> : null}
      {f.mouth === 0 ? <path d="M43 59 q7 6 14 0" stroke="#7f1d1d" strokeWidth="2.4" fill="none" strokeLinecap="round" /> : null}
      {f.mouth === 1 ? <path d="M42 58 q8 9 16 0 Z" fill="#7f1d1d" /> : null}
      {f.mouth === 2 ? <path d="M44 60 h12" stroke="#7f1d1d" strokeWidth="2.4" strokeLinecap="round" /> : null}
    </svg>
  );
}

/** Face with the name under it, for leaderboards and member lists. */
export function FaceWithName({ seed, name, size = 56, note, highlight = false }: { seed: string; name: string; size?: number; note?: string; highlight?: boolean }) {
  return (
    <span className="flex w-[4.75rem] flex-col items-center gap-1 text-center">
      <FaceAvatar seed={seed} size={size} className={highlight ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""} />
      <span className="line-clamp-1 w-full text-xs font-medium">{name}</span>
      {note ? <span className="num text-[11px] text-ink-muted">{note}</span> : null}
    </span>
  );
}
