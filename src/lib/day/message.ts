/**
 * One line under the daily score that says what matters now, from the real numbers and the hour.
 * The first rule that fits wins, so the user gets a single clear nudge instead of a list.
 * Pure: the today screen and the tests share it.
 */
export interface DayMessageInput {
  /** Minutes since local midnight. */
  minutes: number;
  kcal: { eaten: number; target: number } | null;
  protein: { eaten: number; target: number } | null;
  workout: { done: number; total: number };
  tasks: { done: number; total: number };
  /** Minutes of activity logged today (walks, runs...). */
  activeMinutes: number;
  score: number | null;
}

export type Tone = "good" | "info" | "warn";

export interface DayMessage {
  text: string;
  tone: Tone;
}

const fmt = (n: number) => new Intl.NumberFormat("he-IL").format(Math.round(n));

export function dayMessage(i: DayMessageInput): DayMessage {
  const hour = i.minutes / 60;
  const kcalLeft = i.kcal ? i.kcal.target - i.kcal.eaten : null;
  const proteinLeft = i.protein ? Math.max(0, i.protein.target - i.protein.eaten) : null;
  const proteinShare = i.protein && i.protein.target ? i.protein.eaten / i.protein.target : null;
  const workoutLeft = i.workout.total - i.workout.done;
  const tasksLeft = i.tasks.total - i.tasks.done;

  if (i.kcal && kcalLeft !== null && kcalLeft < -i.kcal.target * 0.1) {
    return { tone: "warn", text: `עברת את היעד ב-${fmt(-kcalLeft)} קלוריות. מחר יום חדש. עכשיו עדיף ירקות ומים.` };
  }
  // Most of the calories are gone and protein lags: point to a lean protein that fits.
  if (i.kcal && kcalLeft !== null && proteinLeft !== null && kcalLeft > 0 && kcalLeft <= i.kcal.target * 0.3 && proteinShare !== null && proteinShare < 0.7) {
    return { tone: "info", text: `נשארו ${fmt(kcalLeft)} קלוריות ו-${fmt(proteinLeft)} גרם חלבון. יוגורט חלבון, טונה או חזה עוף יתאימו למסגרת.` };
  }
  if (proteinShare !== null && hour >= 14 && proteinShare < 0.4) {
    return { tone: "info", text: `עד עכשיו ${fmt(i.protein!.eaten)} מתוך ${fmt(i.protein!.target)} גרם חלבון. כדאי מקור חלבון בארוחה הבאה.` };
  }
  if (i.kcal && kcalLeft !== null && kcalLeft >= 0 && kcalLeft <= Math.max(250, i.kcal.target * 0.12) && i.kcal.eaten > 0) {
    return { tone: "info", text: `נשארו ${fmt(kcalLeft)} קלוריות להיום. כדאי לתכנן את הארוחה הבאה בהתאם.` };
  }
  if (workoutLeft > 0 && hour >= 16) {
    return { tone: "info", text: i.workout.done ? `עוד ${workoutLeft} תרגילים ואתה משלים את האימון של היום.` : "האימון של היום עוד מחכה. גם 15 דקות עכשיו ישלימו את יעד הכושר." };
  }
  if (!i.workout.total && i.activeMinutes < 15 && hour >= 17) {
    return { tone: "info", text: "עוד 15 דקות הליכה היום ישלימו את יעד הכושר." };
  }
  if (proteinShare !== null && proteinShare < 1 && hour >= 18 && (i.score ?? 0) >= 60) {
    return { tone: "info", text: `נשאר להשלים ${fmt(proteinLeft!)} גרם חלבון, ואתה סוגר יום מצוין.` };
  }
  if ((i.score ?? 0) >= 85) return { tone: "good", text: tasksLeft > 0 ? "יום מצוין! נשארו רק משימות קטנות." : "יום מצוין! השלמת כמעט הכול." };
  if (hour < 11 && !(i.kcal?.eaten ?? 0)) {
    return { tone: "info", text: proteinLeft ? "בוקר טוב! ארוחת בוקר עם חלבון תקדם אותך כבר מההתחלה." : "בוקר טוב! מתחילים בארוחת בוקר טובה." };
  }
  if ((i.score ?? 0) >= 60) return { tone: "good", text: "אתה בדרך ליום מצוין!" };
  if (tasksLeft > 0) return { tone: "info", text: `נשארו ${tasksLeft} משימות להיום. כל אחת מקרבת את הציון.` };
  return { tone: "info", text: "כל ארוחה שנרשמת וכל תרגיל מעלים את הציון של היום." };
}
