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
/** Hair styles: short, cropped, long, bun, curly, none. */
export const HAIR_STYLES = 6;
export const EYE_STYLES = 3;
export const MOUTH_STYLES = 3;

export interface AvatarConfig {
  bg: number;
  skin: number;
  hair: number;
  style: number;
  eyes: number;
  mouth: number;
  glasses: boolean;
  beard: boolean;
  cheeks: boolean;
  shirt: number;
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
});

export function parseAvatar(v: unknown): AvatarConfig | null {
  const r = avatarSchema.safeParse(v);
  return r.success ? r.data : null;
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
    beard: pick(5) === 0,
    cheeks: pick(2) === 0,
    shirt: pick(AVATAR_SHIRT.length),
  };
}
