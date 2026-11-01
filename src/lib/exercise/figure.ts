/**
 * A small 2D figure for exercise demonstrations (follow-up spec §5).
 *
 * Every exercise is drawn from 2–3 key poses (start, middle, end) written by hand in
 * src/content/exercise-poses.ts. A pose is solved into segment angles, so the animation turns
 * limbs around their joints instead of stretching them. Units: the floor is y = 0, y points
 * up, a standing figure is about 90 units tall and faces right (+x).
 */

export type Pt = readonly [number, number];

export const LEN = { torso: 30, neck: 9, headR: 6, upperArm: 15, forearm: 14, thigh: 21, shin: 21, foot: 7 } as const;
/** Height of the ankle joint above the floor when the foot is flat. */
export const ANKLE_Y = 3.5;
/** Height of the hip of a standing figure. */
export const STAND_HIP_Y = ANKLE_Y + LEN.thigh + LEN.shin - 0.1;

/**
 * A limb is either two absolute angles (degrees, 0 = forward/right, 90 = up), an end point the
 * middle joint bends towards (`bend` +1 or -1 picks the side), or two explicit points (for a
 * limb seen end-on, which looks shorter).
 */
export type Limb = { a: readonly [number, number] } | { to: Pt; bend?: 1 | -1 } | { mid: Pt; end: Pt };

export interface Pose {
  hip: Pt;
  /** Direction from hip to neck. */
  torso: number;
  /** Bend of the spine: + rounds the back upwards, - lets it sag. */
  arch?: number;
  /** Direction from neck to head centre. Defaults to the torso direction. */
  head?: number;
  nLeg: Limb;
  fLeg: Limb;
  nArm: Limb;
  fArm: Limb;
  /** Foot directions from the ankle (0 = flat, pointing forward). */
  nFoot?: number;
  fFoot?: number;
}

export interface Frame {
  pose: Pose;
  caption: string;
}

export type Joint =
  | "hip"
  | "neck"
  | "head"
  | "nShoulder"
  | "fShoulder"
  | "nElbow"
  | "fElbow"
  | "nWrist"
  | "fWrist"
  | "nHip"
  | "fHip"
  | "nKnee"
  | "fKnee"
  | "nAnkle"
  | "fAnkle"
  | "nToe"
  | "fToe";

export type PropRef = Pt | Joint;

export type Prop =
  | { k: "mat"; x1: number; x2: number }
  | { k: "box"; x: number; w: number; h: number }
  | { k: "chair"; x: number; w: number; seat: number; back?: "left" | "right" }
  | { k: "wall"; x: number }
  | { k: "door"; x: number }
  | { k: "bar"; y: number; x1: number; x2: number }
  | { k: "line"; from: PropRef; to: PropRef }
  | { k: "band"; from: PropRef; to: PropRef }
  | { k: "dumbbell"; at: Joint; upright?: boolean }
  | { k: "kettlebell"; at: Joint }
  | { k: "plate"; at: Joint }
  | { k: "platform"; at: Joint; angle: number };

export interface Demo {
  /** "front" faces the viewer: shoulders and hips are drawn apart. */
  view: "side" | "front";
  /** false for a drawing seen from above (no floor line). */
  floor?: boolean;
  frames: Frame[];
  props?: Prop[];
}

/* ───────────────────────── solving ───────────────────────── */

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const add = (p: Pt, ang: number, len: number): Pt => [p[0] + len * Math.cos(rad(ang)), p[1] + len * Math.sin(rad(ang))];
const angleOf = (a: Pt, b: Pt) => deg(Math.atan2(b[1] - a[1], b[0] - a[0]));
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** A limb as [angle, length] of its two segments. */
type Seg2 = [number, number, number, number];

function solveLimb(base: Pt, limb: Limb, l1: number, l2: number, defaultBend: 1 | -1): Seg2 {
  if ("a" in limb) return [limb.a[0], l1, limb.a[1], l2];
  if ("mid" in limb) return [angleOf(base, limb.mid), dist(base, limb.mid), angleOf(limb.mid, limb.end), dist(limb.mid, limb.end)];
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-3, dist(base, limb.to)));
  const a = angleOf(base, limb.to);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = deg(Math.acos(Math.max(-1, Math.min(1, cos))));
  const s = limb.bend ?? defaultBend;
  const joint = add(base, a + s * alpha, l1);
  const end = add(base, a, d);
  return [a + s * alpha, l1, angleOf(joint, end), l2];
}

/** A pose reduced to numbers that can be blended frame to frame. */
export interface Solved {
  hip: Pt;
  torso: number;
  arch: number;
  head: number;
  nLeg: Seg2;
  fLeg: Seg2;
  nArm: Seg2;
  fArm: Seg2;
  nFoot: number;
  fFoot: number;
}

/** Shoulders and hips sit apart in front view, on top of each other in side view. */
function offsets(view: Demo["view"], torso: number) {
  const w = view === "front" ? 1 : 0;
  const perp = torso - 90;
  return { shoulder: (s: 1 | -1) => [perp, 8 * w * s] as const, hip: (s: 1 | -1) => [perp, 5 * w * s] as const };
}

export function solve(pose: Pose, view: Demo["view"]): Solved {
  const neck = add(pose.hip, pose.torso, LEN.torso);
  const o = offsets(view, pose.torso);
  const at = (p: Pt, [ang, len]: readonly [number, number]) => add(p, ang, len);
  return {
    hip: pose.hip,
    torso: pose.torso,
    arch: pose.arch ?? 0,
    head: pose.head ?? pose.torso,
    nLeg: solveLimb(at(pose.hip, o.hip(1)), pose.nLeg, LEN.thigh, LEN.shin, 1),
    fLeg: solveLimb(at(pose.hip, o.hip(-1)), pose.fLeg, LEN.thigh, LEN.shin, 1),
    nArm: solveLimb(at(neck, o.shoulder(1)), pose.nArm, LEN.upperArm, LEN.forearm, -1),
    fArm: solveLimb(at(neck, o.shoulder(-1)), pose.fArm, LEN.upperArm, LEN.forearm, -1),
    nFoot: pose.nFoot ?? (view === "front" ? -60 : 0),
    fFoot: pose.fFoot ?? (view === "front" ? -120 : 0),
  };
}

/** Shortest turn between two angles, so 170° → -170° turns 20°, not 340°. */
function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpSeg = (a: Seg2, b: Seg2, t: number): Seg2 => [lerpAngle(a[0], b[0], t), lerp(a[1], b[1], t), lerpAngle(a[2], b[2], t), lerp(a[3], b[3], t)];

export function blend(a: Solved, b: Solved, t: number): Solved {
  return {
    hip: [lerp(a.hip[0], b.hip[0], t), lerp(a.hip[1], b.hip[1], t)],
    torso: lerpAngle(a.torso, b.torso, t),
    arch: lerp(a.arch, b.arch, t),
    head: lerpAngle(a.head, b.head, t),
    nLeg: lerpSeg(a.nLeg, b.nLeg, t),
    fLeg: lerpSeg(a.fLeg, b.fLeg, t),
    nArm: lerpSeg(a.nArm, b.nArm, t),
    fArm: lerpSeg(a.fArm, b.fArm, t),
    nFoot: lerpAngle(a.nFoot, b.nFoot, t),
    fFoot: lerpAngle(a.fFoot, b.fFoot, t),
  };
}

export type Points = Record<Joint, Pt>;

export function points(s: Solved, view: Demo["view"]): Points {
  const o = offsets(view, s.torso);
  const at = (p: Pt, [ang, len]: readonly [number, number]) => add(p, ang, len);
  const neck = add(s.hip, s.torso, LEN.torso);
  const limb = (base: Pt, g: Seg2) => {
    const mid = add(base, g[0], g[1]);
    return [mid, add(mid, g[2], g[3])] as const;
  };
  const nHip = at(s.hip, o.hip(1));
  const fHip = at(s.hip, o.hip(-1));
  const nShoulder = at(neck, o.shoulder(1));
  const fShoulder = at(neck, o.shoulder(-1));
  const [nKnee, nAnkle] = limb(nHip, s.nLeg);
  const [fKnee, fAnkle] = limb(fHip, s.fLeg);
  const [nElbow, nWrist] = limb(nShoulder, s.nArm);
  const [fElbow, fWrist] = limb(fShoulder, s.fArm);
  const footLen = view === "front" ? 4 : LEN.foot;
  return {
    hip: s.hip,
    neck,
    head: add(neck, s.head, LEN.neck),
    nShoulder,
    fShoulder,
    nElbow,
    fElbow,
    nWrist,
    fWrist,
    nHip,
    fHip,
    nKnee,
    fKnee,
    nAnkle,
    fAnkle,
    nToe: add(nAnkle, s.nFoot, footLen),
    fToe: add(fAnkle, s.fFoot, footLen),
  };
}

/** Control point of the spine curve. */
export function spineControl(s: Solved, p: Points): Pt {
  const mid: Pt = [(p.hip[0] + p.neck[0]) / 2, (p.hip[1] + p.neck[1]) / 2];
  return add(mid, s.torso + 90, s.arch * 2);
}

export const resolveRef = (r: PropRef, p: Points): Pt => (typeof r === "string" ? p[r] : r);

/** Bounding box over every frame and every fixed prop, used for a steady viewBox. */
export function bounds(demo: Demo): { x: number; y: number; w: number; h: number } {
  let x1 = Infinity,
    y1 = 0,
    x2 = -Infinity,
    y2 = -Infinity;
  const take = ([x, y]: Pt, r = 0) => {
    x1 = Math.min(x1, x - r);
    x2 = Math.max(x2, x + r);
    y1 = Math.min(y1, y - r);
    y2 = Math.max(y2, y + r);
  };
  for (const f of demo.frames) {
    const p = points(solve(f.pose, demo.view), demo.view);
    for (const [k, v] of Object.entries(p)) take(v, k === "head" ? LEN.headR + 1 : 4);
  }
  for (const pr of demo.props ?? []) {
    const pts: Pt[] = [];
    if (pr.k === "mat") pts.push([pr.x1, 0], [pr.x2, 0]);
    if (pr.k === "box") pts.push([pr.x, 0], [pr.x + pr.w, pr.h]);
    if (pr.k === "chair") pts.push([pr.x, 0], [pr.x + pr.w, pr.seat + (pr.back ? 22 : 0)]);
    if (pr.k === "wall" || pr.k === "door") pts.push([pr.x, 0], [pr.x + 4, 0]);
    if (pr.k === "bar") pts.push([pr.x1, pr.y + 3], [pr.x2, pr.y]);
    if ((pr.k === "line" || pr.k === "band") && typeof pr.from !== "string") pts.push(pr.from);
    if ((pr.k === "line" || pr.k === "band") && typeof pr.to !== "string") pts.push(pr.to);
    for (const q of pts) take(q, 2);
  }
  const pad = 6;
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + 2 * pad, h: y2 - y1 + 2 * pad };
}
