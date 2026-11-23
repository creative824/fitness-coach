/**
 * The illustrated face a person picks at signup (or gets from their id when they did not):
 * indexes into the palettes and shapes of src/components/ui/face-avatar.tsx. Pure, shared by
 * the server (saving, reading) and the editor.
 */
import { z } from "zod";

export const AVATAR_BG = ["#d9f99d", "#bae6fd", "#fecdd3", "#ddd6fe", "#fde68a", "#a7f3d0", "#fed7aa", "#c7d2fe"];
export const AVATAR_SKIN = ["#f8d5b8", "#eab68f", "#d39a6a", "#b87a4b", "#8d5a35", "#5e3a22"];
export const AVATAR_SHIRT = ["#334155", "#0f766e", "#6d28d9", "#be123c", "#1d4ed8", "#a16207"];
export const AVATAR_HAIR = ["#1f1a17", "#3b2a20", "#6b4226", "#a0522d", "#d6a756", "#8a8a8a"];
export const AVATAR_EYE_COLOR = ["#5b3a1e", "#2b1d14", "#7a6a2a", "#3f7d4e", "#3b6ea8"];
/** Hair styles: short, cropped, long, bun, curly, none, side part, mohawk, wavy long. */
export const HAIR_STYLES = 9;
/** Eyes: open, smiling, wide. */
export const EYE_STYLES = 3;
/** Mouth: smile, laugh, calm, smirk. */
export const MOUTH_STYLES = 4;
/** Brows: soft, straight, bold. */
export const BROW_STYLES = 3;
/** Facial hair: none, stubble, mustache, full beard. */
export const FACIAL_STYLES = 4;
/** Extras: none, earrings, headphones, cap. */
export const ACCESSORIES = 4;

export interface AvatarConfig {
  bg: number;
  skin: number;
  hair: number;
  style: number;
  eyes: number;
  mouth: number;
  glasses: boolean;
  /** Older saves: true means a full beard. `facial` wins when set. */
  beard: boolean;
  cheeks: boolean;
  shirt: number;
  eyeColor: number;
  brows: number;
  facial: number;
  accessory: number;
}

const idx = (n: number) => z.int().min(0).max(n - 1);

export const avatarSchema = z.object({
  bg: idx(AVATAR_BG.length),
  skin: idx(AVATAR_SKIN.length),
  hair: idx(AVATAR_HAIR.length),
  style: idx(HAIR_STYLES),
  eyes: idx(EYE_STYLES),
  mouth: idx(MOUTH_STYLES),
  glasses: z.boolean(),
  beard: z.boolean(),
  cheeks: z.boolean(),
  shirt: idx(AVATAR_SHIRT.length),
  // Added later: faces saved before have none of these.
  eyeColor: idx(AVATAR_EYE_COLOR.length).default(0),
  brows: idx(BROW_STYLES).default(0),
  facial: idx(FACIAL_STYLES).default(0),
  accessory: idx(ACCESSORIES).default(0),
});

export function parseAvatar(v: unknown): AvatarConfig | null {
  const r = avatarSchema.safeParse(v);
  if (!r.success) return null;
  // An old save with a beard and no facial-hair choice keeps its beard.
  const raw = v as { facial?: unknown };
  return r.data.beard && raw.facial === undefined ? { ...r.data, facial: 3 } : r.data;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The face someone gets from an id or a name: the same seed always gives the same face. */
export function avatarFromSeed(seed: string): AvatarConfig {
  let h = hash(seed);
  const pick = (n: number) => {
    const v = h % n;
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    return v;
  };
  return {
    bg: pick(AVATAR_BG.length),
    skin: pick(AVATAR_SKIN.length),
    hair: pick(AVATAR_HAIR.length),
    style: pick(HAIR_STYLES),
    eyes: pick(EYE_STYLES),
    mouth: pick(MOUTH_STYLES),
    glasses: pick(5) === 0,
    beard: false,
    cheeks: pick(2) === 0,
    shirt: pick(AVATAR_SHIRT.length),
    eyeColor: pick(AVATAR_EYE_COLOR.length),
    brows: pick(BROW_STYLES),
    facial: pick(3) === 0 ? 1 + pick(3) : 0,
    accessory: pick(3) === 0 ? 1 + pick(3) : 0,
  };
}
