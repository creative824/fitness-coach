/**
 * Key poses for the exercise demonstrations (follow-up spec §5): start, middle and end of the
 * movement, drawn as a simple figure. Each one was written to match the steps of the same
 * exercise in exercises.ts, and should be checked by the trainer who approves the exercise.
 * No generated images: these are plain drawings, so they show only what is written here.
 *
 * Units and directions: see src/lib/exercise/figure.ts. The figure faces right.
 */
import { ANKLE_Y, LEN, STAND_HIP_Y as S, type Demo, type Limb, type Pose, type Pt } from "@/lib/exercise/figure";

const rad = (d: number) => (d * Math.PI) / 180;
const along = (p: Pt, ang: number, len: number): Pt => [p[0] + len * Math.cos(rad(ang)), p[1] + len * Math.sin(rad(ang))];
const floor = (x: number): Pt => [x, ANKLE_Y];
const LYING = 4; // body line height when lying on the floor
const hang: Limb = { a: [-90, -90] };
const LEG = LEN.thigh + LEN.shin;
const ARM = LEN.upperArm + LEN.forearm;

function stand(over: Partial<Pose> = {}): Pose {
  return { hip: [0, S], torso: 90, nLeg: { to: floor(0) }, fLeg: { to: floor(0) }, nArm: hang, fArm: hang, ...over };
}
const arms = (arm: Limb) => ({ nArm: arm, fArm: arm });
const legs = (leg: Limb) => ({ nLeg: leg, fLeg: leg });

/** A straight body from the ankles (on the toes) with hands under the shoulders on the floor. */
function plankFromFeet(angle: number, handX?: number) {
  const ankle = floor(0);
  const hip = along(ankle, angle, LEG);
  const neck = along(hip, angle, LEN.torso);
  return { hip, neck, handX: handX ?? neck[0] };
}

/** A straight body from the knees (on the floor). */
function plankFromKnees(angle: number) {
  const knee: Pt = [0, ANKLE_Y];
  const hip = along(knee, angle, LEN.thigh);
  const neck = along(hip, angle, LEN.torso);
  return { knee, hip, neck };
}

/* Push-up bottom: chest close to the floor. */
const pushBottom = plankFromFeet(9);
const kneeTopAngle = (Math.asin(ARM / (LEN.thigh + LEN.torso)) * 180) / Math.PI;
const kneeTop = plankFromKnees(kneeTopAngle);
const kneeBottom = plankFromKnees(13);
const kneePushLegs = (k: { hip: Pt; knee: Pt }): Pick<Pose, "nLeg" | "fLeg" | "nFoot" | "fFoot"> => ({
  ...legs({ mid: k.knee, end: [k.knee[0] - 20, ANKLE_Y + 5] }),
  nFoot: -100,
  fFoot: -100,
});

/* Forearm plank: elbows under the shoulders. */
const forearmPlankAngle = (Math.asin(LEN.upperArm / (LEG + LEN.torso)) * 180) / Math.PI;
const fp = plankFromFeet(forearmPlankAngle);
const forearms: Limb = { a: [-90, 0] };

/* Knee plank on the forearms: straight line from knees to head. */
const kpAngle = (Math.asin(LEN.upperArm / (LEN.thigh + LEN.torso)) * 180) / Math.PI;
const kp = plankFromKnees(kpAngle);

/* All fours: hips over knees, hands under shoulders. */
const quadHip: Pt = [0, ANKLE_Y + LEN.thigh];
const quadTorso = (Math.asin((ANKLE_Y + ARM - quadHip[1]) / LEN.torso) * 180) / Math.PI;
const quadNeck = along(quadHip, quadTorso, LEN.torso);
const quadLegs: Pick<Pose, "nLeg" | "fLeg"> = legs({ mid: [0, ANKLE_Y], end: [-LEN.shin, ANKLE_Y] });
const quadArms = arms({ to: floor(quadNeck[0]) });

/* Lying on the back, knees bent, feet flat. */
const supineLegs = legs({ to: floor(16) });

/* Hanging from a bar, front view. */
const BAR_Y = 112;
const hangHands = { nArm: { to: [18, BAR_Y] as Pt, bend: 1 as const }, fArm: { to: [-18, BAR_Y] as Pt, bend: -1 as const } };

export const DEMOS: Record<string, Demo> = {
  // ── Lower body ─────────────────────────────────────────────
  "bodyweight-squat": {
    view: "side",
    frames: [
      { caption: "עמידת מוצא", pose: stand() },
      { caption: "ירידה מבוקרת לאחור", pose: stand({ hip: [-13, 26], torso: 52, ...arms({ a: [5, 5] }) }) },
      { caption: "חזרה לעמידה", pose: stand() },
    ],
  },
  "sit-to-stand": {
    view: "side",
    props: [{ k: "chair", x: -20, w: 20, seat: 21, back: "left" }],
    frames: [
      { caption: "ישיבה בקצה הכיסא", pose: { hip: [-4, 24.5], torso: 82, ...legs({ to: floor(13) }), ...arms({ a: [-60, 165] }) } },
      { caption: "נטייה קדימה וקימה", pose: { hip: [2, 30], torso: 48, ...legs({ to: floor(13) }), ...arms({ a: [-35, 170] }) } },
      { caption: "עמידה מלאה", pose: { hip: [12, S], torso: 90, ...legs({ to: floor(13) }), ...arms({ a: [-60, 165] }) } },
    ],
  },
  "goblet-squat": {
    view: "side",
    props: [{ k: "dumbbell", at: "nWrist", upright: true }],
    frames: [
      { caption: "משקולת צמודה לחזה", pose: stand({ ...arms({ a: [-75, 105] }) }) },
      { caption: "ירידה, חזה זקוף", pose: stand({ hip: [-11, 24], torso: 66, ...arms({ a: [-40, 125] }) }) },
      { caption: "עלייה בדחיפה", pose: stand({ ...arms({ a: [-75, 105] }) }) },
    ],
  },
  "reverse-lunge": {
    view: "side",
    frames: [
      { caption: "עמידה, ידיים על המותניים", pose: stand({ ...arms({ to: [5, S + 2], bend: -1 }) }) },
      {
        caption: "צעד גדול לאחור וירידה",
        pose: {
          hip: [-11, 27],
          torso: 88,
          nLeg: { to: floor(8) },
          fLeg: { mid: [-17, 7], end: [-36, 8] },
          fFoot: -40,
          ...arms({ to: [-6, 29], bend: -1 }),
        },
      },
      { caption: "חזרה לעמידה", pose: stand({ ...arms({ to: [5, S + 2], bend: -1 }) }) },
    ],
  },
  "glute-bridge": {
    view: "side",
    props: [{ k: "mat", x1: -45, x2: 30 }],
    frames: [
      { caption: "שכיבה, ברכיים כפופות", pose: { hip: [0, LYING], torso: 180, head: 180, ...supineLegs, ...arms({ a: [0, 0] }) } },
      {
        caption: "הרמת אגן לקו ישר",
        pose: { hip: [0, 19], torso: 180 + (Math.asin((19 - LYING) / LEN.torso) * 180) / Math.PI, head: 180, ...supineLegs, ...arms({ a: [0, 0] }) },
      },
      { caption: "ירידה לאט", pose: { hip: [0, LYING], torso: 180, head: 180, ...supineLegs, ...arms({ a: [0, 0] }) } },
    ],
  },
  "romanian-deadlift-db": {
    view: "side",
    props: [{ k: "dumbbell", at: "nWrist" }],
    frames: [
      { caption: "עמידה, משקולות מול הירכיים", pose: stand({ hip: [0, S - 1.5] }) },
      { caption: "אגן לאחור, גב ישר", pose: stand({ hip: [-9, 41], torso: 22 }) },
      { caption: "חזרה בכיווץ הישבן", pose: stand({ hip: [0, S - 1.5] }) },
    ],
  },
  "step-up": {
    view: "side",
    props: [{ k: "box", x: 8, w: 24, h: 16 }],
    frames: [
      { caption: "רגל אחת על המדרגה", pose: stand({ torso: 84, nLeg: { to: [17, 16 + ANKLE_Y] } }) },
      { caption: "דחיפה דרך העקב", pose: stand({ hip: [10, 52], torso: 80, nLeg: { to: [17, 16 + ANKLE_Y] }, fLeg: { to: [2, 9] }, fFoot: -50 }) },
      { caption: "עמידה מלאה למעלה", pose: stand({ hip: [17, 16 + S], nLeg: { to: [17, 16 + ANKLE_Y] }, fLeg: { to: [15, 16 + ANKLE_Y] } }) },
    ],
  },
  "calf-raise": {
    view: "side",
    props: [{ k: "wall", x: 26 }],
    frames: [
      { caption: "עמידה ליד קיר", pose: stand({ ...arms({ to: [23, 72], bend: -1 }) }) },
      { caption: "עלייה על קצות האצבעות", pose: stand({ hip: [3, S + 5], ...legs({ to: [3, ANKLE_Y + 5] }), nFoot: -45, fFoot: -45, ...arms({ to: [23, 77], bend: -1 }) }) },
      { caption: "ירידה בשליטה", pose: stand({ ...arms({ to: [23, 72], bend: -1 }) }) },
    ],
  },
  "wall-sit": {
    view: "side",
    props: [{ k: "wall", x: -21 }],
    frames: [
      { caption: "גב צמוד לקיר", pose: stand({ hip: [-16, S - 1], ...legs({ to: floor(-6) }) }) },
      { caption: "החלקה מטה והחזקה", pose: stand({ hip: [-16, 25], ...legs({ to: floor(5) }), ...arms({ a: [-70, -10] }) }) },
    ],
  },
  "kettlebell-swing": {
    view: "side",
    props: [{ k: "kettlebell", at: "nWrist" }],
    frames: [
      { caption: "כפיפת אגן, הקטלבל בין הרגליים", pose: stand({ hip: [-9, 39], torso: 32, ...arms({ a: [-118, -112] }) }) },
      { caption: "יישור אגן בעוצמה", pose: stand({ ...arms({ a: [-5, -2] }) }) },
    ],
  },
  "barbell-back-squat": {
    view: "side",
    props: [{ k: "plate", at: "neck" }],
    frames: [
      { caption: "מוט על הגב העליון", pose: stand({ ...arms({ to: [-3, S + LEN.torso + 2], bend: -1 }) }) },
      { caption: "ירידה בשליטה", pose: stand({ hip: [-13, 26], torso: 55, ...arms({ to: [1, 52], bend: -1 }) }) },
      { caption: "עלייה בדחיפה", pose: stand({ ...arms({ to: [-3, S + LEN.torso + 2], bend: -1 }) }) },
    ],
  },
  "leg-press": {
    view: "side",
    props: [
      { k: "line", from: [-30, 52], to: [-4, 16] },
      { k: "line", from: [-4, 16], to: [8, 16] },
      { k: "line", from: [-4, 16], to: [-4, 0] },
      { k: "platform", at: "nAnkle", angle: 40 },
    ],
    frames: [
      { caption: "ברכיים כפופות, כפות רגליים על הפלטה", pose: { hip: [0, 20], torso: 126, ...legs({ to: [20, 40] }), nFoot: 125, fFoot: 125, ...arms({ a: [-50, 10] }) } },
      { caption: "דחיפה בלי לנעול ברכיים", pose: { hip: [0, 20], torso: 126, ...legs({ to: [31, 47] }), nFoot: 125, fFoot: 125, ...arms({ a: [-50, 10] }) } },
    ],
  },

  // ── Push ─────────────────────────────────────────────
  "wall-push-up": (() => {
    const top = { hip: along(floor(0), 76, LEG), torso: 76 };
    const shoulderTop = along(top.hip, 76, LEN.torso);
    const wallX = shoulderTop[0] + ARM - 1;
    const low = { hip: along(floor(0), 63, LEG), torso: 63 };
    const hand: Pt = [wallX - 2, shoulderTop[1]];
    return {
      view: "side",
      props: [{ k: "wall", x: wallX }],
      frames: [
        { caption: "ידיים על הקיר בגובה הכתפיים", pose: stand({ ...top, nFoot: 0, ...arms({ to: hand, bend: -1 }) }) },
        { caption: "החזה מתקרב לקיר, גוף ישר", pose: stand({ ...low, ...arms({ to: hand, bend: -1 }) }) },
        { caption: "דחיפה חזרה", pose: stand({ ...top, ...arms({ to: hand, bend: -1 }) }) },
      ],
    } satisfies Demo;
  })(),
  "knee-push-up": {
    view: "side",
    props: [{ k: "mat", x1: -30, x2: 60 }],
    frames: [
      { caption: "ידיים מתחת לכתפיים, קו ישר מהברכיים", pose: { hip: kneeTop.hip, torso: kneeTopAngle, ...kneePushLegs(kneeTop), ...arms({ to: floor(kneeTop.neck[0]) }) } },
      { caption: "החזה יורד לכיוון הרצפה", pose: { hip: kneeBottom.hip, torso: 13, ...kneePushLegs(kneeBottom), ...arms({ to: floor(kneeTop.neck[0]), bend: 1 }) } },
      { caption: "דחיפה חזרה", pose: { hip: kneeTop.hip, torso: kneeTopAngle, ...kneePushLegs(kneeTop), ...arms({ to: floor(kneeTop.neck[0]) }) } },
    ],
  },
  "push-up": (() => {
    const topAngle = (Math.asin(ARM / (LEG + LEN.torso)) * 180) / Math.PI;
    const top = plankFromFeet(topAngle);
    const hand = floor(top.neck[0]);
    const toes = { ...legs({ to: floor(0) }), nFoot: -25, fFoot: -25 };
    return {
      view: "side",
      frames: [
        { caption: "גוף ישר מהראש לעקבים", pose: { hip: top.hip, torso: topAngle, ...toes, ...arms({ to: hand }) } },
        { caption: "החזה יורד, מרפקים לאחור", pose: { hip: pushBottom.hip, torso: 9, ...toes, ...arms({ to: hand, bend: 1 }) } },
        { caption: "דחיפה בלי שהאגן ישקע", pose: { hip: top.hip, torso: topAngle, ...toes, ...arms({ to: hand }) } },
      ],
    } satisfies Demo;
  })(),
  "db-floor-press": {
    view: "side",
    props: [{ k: "mat", x1: -48, x2: 28 }, { k: "dumbbell", at: "nWrist" }],
    frames: [
      { caption: "מרפקים על הרצפה", pose: { hip: [0, LYING], torso: 180, head: 180, ...supineLegs, ...arms({ a: [-5, 90] }) } },
      { caption: "דחיפה עד יישור", pose: { hip: [0, LYING], torso: 180, head: 180, ...supineLegs, ...arms({ a: [90, 90] }) } },
    ],
  },
  "db-bench-press": {
    view: "side",
    props: [{ k: "box", x: -42, w: 48, h: 17 }, { k: "dumbbell", at: "nWrist" }],
    frames: [
      { caption: "משקולות מעל החזה", pose: { hip: [0, 21], torso: 180, head: 180, ...legs({ to: floor(18) }), ...arms({ a: [90, 90] }) } },
      { caption: "ירידה בשליטה לגובה החזה", pose: { hip: [0, 21], torso: 180, head: 180, ...legs({ to: floor(18) }), ...arms({ a: [-60, 90] }) } },
      { caption: "דחיפה חזרה", pose: { hip: [0, 21], torso: 180, head: 180, ...legs({ to: floor(18) }), ...arms({ a: [90, 90] }) } },
    ],
  },
  "db-shoulder-press": {
    view: "front",
    props: [{ k: "dumbbell", at: "nWrist" }, { k: "dumbbell", at: "fWrist" }],
    frames: [
      { caption: "משקולות בגובה הכתפיים", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [-10, 90] }, fArm: { a: [190, 90] } }) },
      { caption: "דחיפה מעלה בלי לקשת את הגב", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [80, 95] }, fArm: { a: [100, 85] } }) },
      { caption: "הורדה לגובה הכתפיים", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [-10, 90] }, fArm: { a: [190, 90] } }) },
    ],
  },
  "bench-dip": {
    view: "side",
    props: [{ k: "box", x: -34, w: 30, h: 20 }],
    frames: [
      { caption: "ידיים על קצה הספסל, זרועות ישרות", pose: { hip: [2, 24], torso: 95, ...legs({ to: floor(30) }), ...arms({ to: [-4, 23.5], bend: -1 }) } },
      { caption: "כפיפת מרפקים לכ-90 מעלות", pose: { hip: [3, 11], torso: 92, ...legs({ to: floor(30) }), ...arms({ to: [-4, 23.5], bend: 1 }) } },
      { caption: "דחיפה חזרה", pose: { hip: [2, 24], torso: 95, ...legs({ to: floor(30) }), ...arms({ to: [-4, 23.5], bend: -1 }) } },
    ],
  },
  "band-triceps-pushdown": {
    view: "side",
    props: [{ k: "band", from: [14, 96], to: "nWrist" }],
    frames: [
      { caption: "מרפקים צמודים לגוף", pose: stand({ ...arms({ a: [-95, 15] }) }) },
      { caption: "יישור הזרועות מטה", pose: stand({ ...arms({ a: [-95, -80] }) }) },
    ],
  },

  // ── Pull ─────────────────────────────────────────────
  "db-row": {
    view: "side",
    props: [{ k: "box", x: 22, w: 28, h: 22 }, { k: "dumbbell", at: "nWrist" }],
    frames: [
      { caption: "יד על הספסל, גב ישר", pose: { hip: [0, 44], torso: 10, nLeg: { to: floor(2) }, fLeg: { to: floor(-6) }, fArm: { to: [33, 22 + ANKLE_Y] }, nArm: hang } },
      { caption: "משיכה למותן, מרפק צמוד", pose: { hip: [0, 44], torso: 10, nLeg: { to: floor(2) }, fLeg: { to: floor(-6) }, fArm: { to: [33, 22 + ANKLE_Y] }, nArm: { a: [168, -88] } } },
      { caption: "הורדה בשליטה", pose: { hip: [0, 44], torso: 10, nLeg: { to: floor(2) }, fLeg: { to: floor(-6) }, fArm: { to: [33, 22 + ANKLE_Y] }, nArm: hang } },
    ],
  },
  "band-row": {
    view: "side",
    props: [{ k: "band", from: [52, 70], to: "nWrist" }, { k: "line", from: [54, 0], to: [54, 100] }],
    frames: [
      { caption: "מול הגומייה, ידיים מושטות", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, ...arms({ a: [-12, -8] }) }) },
      { caption: "משיכה לצלעות, שכמות נצמדות", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, ...arms({ a: [-150, 5] }) }) },
    ],
  },
  "band-pull-apart": {
    view: "front",
    props: [{ k: "band", from: "nWrist", to: "fWrist" }],
    frames: [
      { caption: "גומייה מול החזה, זרועות ישרות", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { mid: [8, 70], end: [5, 70] }, fArm: { mid: [-8, 70], end: [-5, 70] } }) },
      { caption: "פתיחה לצדדים עד החזה", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [0, 0] }, fArm: { a: [180, 180] } }) },
    ],
  },
  "lat-pulldown": {
    view: "front",
    props: [
      { k: "chair", x: -14, w: 28, seat: 24 },
      { k: "line", from: [0, 130], to: "head" },
      { k: "band", from: "nWrist", to: "fWrist" },
    ],
    frames: [
      {
        caption: "אחיזה רחבה, זרועות ישרות",
        pose: { hip: [0, 27], torso: 90, nLeg: { mid: [8, 24], end: [9, ANKLE_Y] }, fLeg: { mid: [-8, 24], end: [-9, ANKLE_Y] }, nArm: { to: [24, 112] }, fArm: { to: [-24, 112] } },
      },
      {
        caption: "משיכה לחזה העליון",
        pose: { hip: [0, 27], torso: 90, nLeg: { mid: [8, 24], end: [9, ANKLE_Y] }, fLeg: { mid: [-8, 24], end: [-9, ANKLE_Y] }, nArm: { to: [21, 76], bend: -1 }, fArm: { to: [-21, 76], bend: 1 } },
      },
    ],
  },
  "assisted-pull-up": {
    view: "front",
    props: [
      { k: "bar", y: BAR_Y, x1: -32, x2: 32 },
      { k: "band", from: [-4, BAR_Y], to: "nKnee" },
      { k: "band", from: [4, BAR_Y], to: "nKnee" },
    ],
    frames: [
      { caption: "תלייה, ברך בתוך הגומייה", pose: { hip: [0, BAR_Y - ARM - LEN.torso + 1], torso: 90, nLeg: { mid: [4, 40], end: [-2, 30] }, fLeg: { to: [-4, 26] }, ...hangHands } },
      { caption: "משיכה עד שהסנטר מעל המוט", pose: { hip: [0, BAR_Y - LEN.torso - 4], torso: 90, nLeg: { mid: [4, 57], end: [-2, 47] }, fLeg: { to: [-4, 42] }, nArm: { to: [18, BAR_Y], bend: -1 }, fArm: { to: [-18, BAR_Y], bend: 1 } } },
      { caption: "ירידה בשליטה", pose: { hip: [0, BAR_Y - ARM - LEN.torso + 1], torso: 90, nLeg: { mid: [4, 40], end: [-2, 30] }, fLeg: { to: [-4, 26] }, ...hangHands } },
    ],
  },
  "pull-up": {
    view: "front",
    props: [{ k: "bar", y: BAR_Y, x1: -32, x2: 32 }],
    frames: [
      { caption: "תלייה, אחיזה מעט רחבה", pose: { hip: [0, BAR_Y - ARM - LEN.torso + 1], torso: 90, nLeg: { to: [5, BAR_Y - ARM - LEN.torso + 1 - LEG + 0.2] }, fLeg: { to: [-5, BAR_Y - ARM - LEN.torso + 1 - LEG + 0.2] }, ...hangHands } },
      { caption: "משיכה בלי נדנוד", pose: { hip: [0, BAR_Y - LEN.torso - 4], torso: 90, nLeg: { to: [5, BAR_Y - LEN.torso - 4 - LEG + 0.2] }, fLeg: { to: [-5, BAR_Y - LEN.torso - 4 - LEG + 0.2] }, nArm: { to: [18, BAR_Y], bend: -1 }, fArm: { to: [-18, BAR_Y], bend: 1 } } },
      { caption: "ירידה בשליטה", pose: { hip: [0, BAR_Y - ARM - LEN.torso + 1], torso: 90, nLeg: { to: [5, BAR_Y - ARM - LEN.torso + 1 - LEG + 0.2] }, fLeg: { to: [-5, BAR_Y - ARM - LEN.torso + 1 - LEG + 0.2] }, ...hangHands } },
    ],
  },
  "db-biceps-curl": {
    view: "side",
    props: [{ k: "dumbbell", at: "nWrist" }],
    frames: [
      { caption: "זרועות ישרות לצד הגוף", pose: stand({ ...arms({ a: [-92, -88] }) }) },
      { caption: "כפיפת מרפקים לכתפיים", pose: stand({ ...arms({ a: [-92, 75] }) }) },
      { caption: "הורדה לאט", pose: stand({ ...arms({ a: [-92, -88] }) }) },
    ],
  },
  "band-biceps-curl": {
    view: "side",
    props: [{ k: "band", from: "nToe", to: "nWrist" }],
    frames: [
      { caption: "עומדים על הגומייה", pose: stand({ ...arms({ a: [-92, -80] }) }) },
      { caption: "כפיפת מרפקים", pose: stand({ ...arms({ a: [-92, 75] }) }) },
    ],
  },
  "band-face-pull": {
    view: "side",
    props: [{ k: "band", from: [52, 84], to: "nWrist" }, { k: "line", from: [54, 0], to: [54, 100] }],
    frames: [
      { caption: "ידיים מושטות לגומייה", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, ...arms({ a: [12, 12] }) }) },
      { caption: "משיכה לפנים, מרפקים גבוהים", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, ...arms({ a: [172, 55] }) }) },
    ],
  },
  "db-lateral-raise": {
    view: "front",
    props: [{ k: "dumbbell", at: "nWrist" }, { k: "dumbbell", at: "fWrist" }],
    frames: [
      { caption: "משקולות לצד הגוף", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [-82, -86] }, fArm: { a: [-98, -94] } }) },
      { caption: "הרמה עד גובה הכתפיים", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [-2, 8] }, fArm: { a: [182, 172] } }) },
      { caption: "הורדה לאט", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [-82, -86] }, fArm: { a: [-98, -94] } }) },
    ],
  },

  // ── Core ─────────────────────────────────────────────
  plank: {
    view: "side",
    props: [{ k: "mat", x1: -10, x2: 95 }],
    frames: [
      { caption: "אמות על הרצפה, ברכיים למטה", pose: { hip: kp.hip, torso: kpAngle, ...legs({ mid: kp.knee, end: [-20, ANKLE_Y + 4] }), nFoot: -100, fFoot: -100, ...arms(forearms) } },
      { caption: "הרמה לקו ישר והחזקה", pose: { hip: fp.hip, torso: forearmPlankAngle, ...legs({ to: floor(0) }), nFoot: -25, fFoot: -25, ...arms(forearms) } },
    ],
  },
  "knee-plank": {
    view: "side",
    props: [{ k: "mat", x1: -28, x2: 75 }],
    frames: [
      { caption: "על ארבע, אמות על הרצפה", pose: { hip: quadHip, torso: (Math.asin((ANKLE_Y + LEN.upperArm - quadHip[1]) / LEN.torso) * 180) / Math.PI, ...quadLegs, ...arms(forearms) } },
      { caption: "קו ישר מהברכיים לראש", pose: { hip: kp.hip, torso: kpAngle, ...legs({ mid: kp.knee, end: [-20, ANKLE_Y + 4] }), nFoot: -100, fFoot: -100, ...arms(forearms) } },
    ],
  },
  "side-plank-knee": {
    view: "side",
    props: [{ k: "mat", x1: -28, x2: 65 }],
    frames: [
      { caption: "שכיבה על הצד, נשענים על האמה", pose: { hip: [20, 7], torso: (Math.asin((ANKLE_Y + LEN.upperArm - 7) / LEN.torso) * 180) / Math.PI, nLeg: { mid: [2, ANKLE_Y], end: [-14, ANKLE_Y + 2] }, fLeg: { mid: [2, ANKLE_Y + 3], end: [-14, ANKLE_Y + 5] }, nArm: forearms, fArm: { a: [-60, -20] } } },
      { caption: "הרמת האגן לקו ישר", pose: { hip: along([0, ANKLE_Y], 15.5, LEN.thigh), torso: 15.5, nLeg: { mid: [0, ANKLE_Y], end: [-14, ANKLE_Y + 2] }, fLeg: { mid: [0, ANKLE_Y + 3], end: [-14, ANKLE_Y + 5] }, nArm: forearms, fArm: { a: [-60, -20] } } },
    ],
  },
  "dead-bug": {
    view: "side",
    props: [{ k: "mat", x1: -48, x2: 30 }],
    frames: [
      { caption: "ידיים לתקרה, ברכיים מעל האגן", pose: { hip: [0, LYING], torso: 180, head: 180, ...legs({ a: [90, 0] }), ...arms({ a: [90, 90] }) } },
      { caption: "יד ורגל נגדיות מתרחקות", pose: { hip: [0, LYING], torso: 180, head: 180, nLeg: { a: [90, 0] }, fLeg: { a: [12, 6] }, nArm: { a: [172, 176] }, fArm: { a: [90, 90] } } },
      { caption: "חזרה והחלפת צד", pose: { hip: [0, LYING], torso: 180, head: 180, ...legs({ a: [90, 0] }), ...arms({ a: [90, 90] }) } },
    ],
  },
  "bird-dog": {
    view: "side",
    props: [{ k: "mat", x1: -50, x2: 50 }],
    frames: [
      { caption: "על ארבע, גב ישר", pose: { hip: quadHip, torso: quadTorso, ...quadLegs, ...quadArms } },
      { caption: "יד ורגל נגדיות מושטות", pose: { hip: quadHip, torso: quadTorso, nLeg: quadLegs.nLeg, fLeg: { a: [182, 180] }, nArm: { a: [8, 8] }, fArm: quadArms.fArm } },
      { caption: "חזרה והחלפת צד", pose: { hip: quadHip, torso: quadTorso, ...quadLegs, ...quadArms } },
    ],
  },
  "superman-hold": {
    view: "side",
    props: [{ k: "mat", x1: -70, x2: 50 }],
    frames: [
      { caption: "שכיבה על הבטן, ידיים קדימה", pose: { hip: [0, LYING], torso: 180, head: 180, ...legs({ a: [0, 0] }), ...arms({ a: [180, 180] }) } },
      { caption: "הרמה קלה והחזקה", pose: { hip: [0, LYING], torso: 172, head: 168, ...legs({ a: [7, 7] }), ...arms({ a: [166, 166] }) } },
    ],
  },

  // ── Cardio ─────────────────────────────────────────────
  "brisk-walk": {
    view: "side",
    frames: [
      { caption: "צעד קדימה", pose: stand({ hip: [0, S - 3], torso: 87, nLeg: { to: floor(13) }, fLeg: { to: floor(-12) }, fFoot: -25, nArm: { a: [-115, -80] }, fArm: { a: [-65, -20] } }) },
      { caption: "מעבר רגל", pose: stand({ torso: 87, nLeg: { to: floor(1) }, fLeg: { to: [-1, 12] }, fFoot: -40, nArm: { a: [-92, -85] }, fArm: { a: [-88, -70] } }) },
      { caption: "צעד ברגל השנייה, ידיים מתחלפות", pose: stand({ hip: [0, S - 3], torso: 87, fLeg: { to: floor(13) }, nLeg: { to: floor(-12) }, nFoot: -25, fArm: { a: [-115, -80] }, nArm: { a: [-65, -20] } }) },
    ],
  },
  "march-in-place": {
    view: "side",
    frames: [
      { caption: "ברך אחת עולה", pose: stand({ nLeg: { a: [5, -90] }, nArm: { a: [-115, -80] }, fArm: { a: [-60, -10] } }) },
      { caption: "החלפה", pose: stand() },
      { caption: "הברך השנייה עולה", pose: stand({ fLeg: { a: [5, -90] }, fArm: { a: [-115, -80] }, nArm: { a: [-60, -10] } }) },
    ],
  },
  "step-jack": {
    view: "front",
    frames: [
      { caption: "עמידה, ידיים למטה", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [-85, -88] }, fArm: { a: [-95, -92] } }) },
      { caption: "צעד לצד וידיים מעל הראש", pose: stand({ hip: [4, S - 1], nLeg: { to: floor(24) }, fLeg: { to: floor(-6) }, nArm: { a: [60, 80] }, fArm: { a: [120, 100] } }) },
      { caption: "חזרה והחלפת צד", pose: stand({ hip: [-4, S - 1], nLeg: { to: floor(6) }, fLeg: { to: floor(-24) }, nArm: { a: [60, 80] }, fArm: { a: [120, 100] } }) },
    ],
  },
  "jumping-jacks": {
    view: "front",
    frames: [
      { caption: "רגליים צמודות, ידיים למטה", pose: stand({ nLeg: { to: floor(5) }, fLeg: { to: floor(-5) }, nArm: { a: [-85, -88] }, fArm: { a: [-95, -92] } }) },
      { caption: "קפיצה לפתיחה, ידיים למעלה", pose: stand({ hip: [0, S - 1], nLeg: { to: floor(22) }, fLeg: { to: floor(-22) }, nArm: { a: [60, 80] }, fArm: { a: [120, 100] } }) },
    ],
  },
  "mountain-climber": (() => {
    const topAngle = (Math.asin(ARM / (LEG + LEN.torso)) * 180) / Math.PI;
    const top = plankFromFeet(topAngle);
    const hand = floor(top.neck[0]);
    const hip: Pt = [top.hip[0] + 2, top.hip[1] - 1];
    const tuck: Limb = { to: [top.hip[0] + 10, 12], bend: 1 };
    return {
      view: "side",
      frames: [
        { caption: "תנוחת שכיבת סמיכה", pose: { hip, torso: topAngle, ...legs({ to: floor(0) }), nFoot: -25, fFoot: -25, ...arms({ to: hand }) } },
        { caption: "ברך אחת לחזה", pose: { hip, torso: topAngle, nLeg: tuck, fLeg: { to: floor(0) }, nFoot: -60, fFoot: -25, ...arms({ to: hand }) } },
        { caption: "החלפה מהירה", pose: { hip, torso: topAngle, fLeg: tuck, nLeg: { to: floor(0) }, fFoot: -60, nFoot: -25, ...arms({ to: hand }) } },
      ],
    } satisfies Demo;
  })(),

  // ── Mobility ─────────────────────────────────────────────
  "cat-cow": {
    view: "side",
    props: [{ k: "mat", x1: -28, x2: 50 }],
    frames: [
      { caption: "על ארבע", pose: { hip: quadHip, torso: quadTorso, ...quadLegs, ...quadArms } },
      { caption: "בשאיפה: בטן למטה, מבט למעלה", pose: { hip: quadHip, torso: quadTorso, arch: -5, head: 45, ...quadLegs, ...quadArms } },
      { caption: "בנשיפה: גב מעוגל, ראש למטה", pose: { hip: quadHip, torso: quadTorso, arch: 6, head: -55, ...quadLegs, ...quadArms } },
    ],
  },
  "hip-flexor-stretch": {
    view: "side",
    props: [{ k: "mat", x1: -36, x2: 34 }],
    frames: [
      { caption: "כריעה על ברך אחת", pose: { hip: [-4, ANKLE_Y + LEN.thigh], torso: 90, nLeg: { to: floor(18) }, fLeg: { mid: [-4, ANKLE_Y], end: [-24, ANKLE_Y + 3] }, fFoot: -100, ...arms({ to: [-1, ANKLE_Y + LEN.thigh + 2], bend: -1 }) } },
      { caption: "כיווץ ישבן ואגן מעט קדימה", pose: { hip: [3, ANKLE_Y + LEN.thigh - 1.5], torso: 92, nLeg: { to: floor(18) }, fLeg: { mid: [-4, ANKLE_Y], end: [-24, ANKLE_Y + 3] }, fFoot: -100, ...arms({ to: [6, ANKLE_Y + LEN.thigh + 1], bend: -1 }) } },
    ],
  },
  "hamstring-stretch": {
    view: "side",
    props: [{ k: "box", x: 22, w: 18, h: 14 }],
    frames: [
      { caption: "עקב על מדרגה, ברך ישרה", pose: stand({ nLeg: { to: [30, 14 + ANKLE_Y] }, nFoot: 60, fLeg: { to: floor(-4) } }) },
      { caption: "נטייה קדימה מהאגן, גב ישר", pose: stand({ hip: [-3, S - 2], torso: 55, nLeg: { to: [30, 14 + ANKLE_Y] }, nFoot: 60, fLeg: { to: floor(-4) }, ...arms({ a: [-70, -70] }) }) },
    ],
  },
  "doorway-chest-stretch": {
    view: "side",
    props: [{ k: "door", x: 16 }],
    frames: [
      { caption: "אמה על המשקוף, מרפק בגובה הכתף", pose: stand({ hip: [0, S], nLeg: { to: floor(2) }, fLeg: { to: floor(-4) }, nArm: { a: [0, 92] } }) },
      { caption: "צעד קטן קדימה עד מתיחה", pose: stand({ hip: [10, S - 1.5], torso: 88, nLeg: { to: floor(22) }, fLeg: { to: floor(0) }, nArm: { mid: [15, 75.4], end: [15, 89.4] } }) },
    ],
  },
  // Seen from above: the floor is the page, "forward" is up.
  "thoracic-rotation": {
    view: "side",
    floor: false,
    frames: [
      { caption: "מבט מלמעלה: שכיבה על הצד, ידיים קדימה", pose: { hip: [0, 30], torso: 180, head: 180, ...legs({ a: [90, 0] }), ...arms({ a: [90, 90] }) } },
      { caption: "היד העליונה נפתחת לצד השני", pose: { hip: [0, 30], torso: 180, head: 200, ...legs({ a: [90, 0] }), nArm: { a: [90, 90] }, fArm: { a: [-88, -88] } } },
      { caption: "חזרה לאט", pose: { hip: [0, 30], torso: 180, head: 180, ...legs({ a: [90, 0] }), ...arms({ a: [90, 90] }) } },
    ],
  },
};
