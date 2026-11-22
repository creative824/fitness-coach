/**
 * Body mass index: weight (kg) / height (m)². WHO adult categories. A rough screening number
 * that does not tell muscle from fat; shown with that note.
 */
export function bmiOf(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm < 100) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export const BMI_BANDS = [
  { max: 18.5, label: "תת-משקל", tone: "sky" },
  { max: 25, label: "תקין", tone: "accent" },
  { max: 30, label: "עודף משקל", tone: "warning" },
  { max: Infinity, label: "השמנה", tone: "coral" },
] as const;

export function bmiBand(bmi: number) {
  return BMI_BANDS.find((b) => bmi < b.max) ?? BMI_BANDS[3];
}
