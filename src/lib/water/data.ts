import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VESSEL_ML, dailyWaterTargetMl, waterPace, type WaterPace } from "./plan";
import { localDay } from "./time";

export interface WaterToday {
  date: string;
  vesselMl: number;
  drankMl: number;
  /** null when no target is set (medical restriction). */
  pace: WaterPace | null;
}

/** Today's water state for the signed-in user. Workout days add to the target from phase 3. */
export async function loadWaterToday(userId: string, workoutToday = false, now = new Date()): Promise<WaterToday> {
  const supabase = await createClient();
  const { date, minutes } = localDay(now);
  const [{ data: profile, error: pe }, { data: logs, error: le }] = await Promise.all([
    supabase.from("profiles").select("weight_kg, water_vessel_ml, safety_flags").eq("user_id", userId).maybeSingle(),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("date", date),
  ]);
  if (pe) throw new Error(pe.message);
  if (le) throw new Error(le.message);

  const answers = (profile?.safety_flags as { answers?: Record<string, boolean | null> } | null)?.answers ?? {};
  const vesselMl = profile?.water_vessel_ml ?? DEFAULT_VESSEL_ML;
  const drankMl = (logs ?? []).reduce((sum, l) => sum + l.amount_ml, 0);
  const target = dailyWaterTargetMl({
    weightKg: profile?.weight_kg ? Number(profile.weight_kg) : null,
    workoutToday,
    medicalRestriction: Boolean(answers.medical_condition || answers.medical_restriction),
  });
  return { date, vesselMl, drankMl, pace: target === null ? null : waterPace(drankMl, target, vesselMl, minutes) };
}
