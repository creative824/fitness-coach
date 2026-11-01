import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VESSEL_ML } from "./plan";
import { localDay } from "./time";

export interface WaterState {
  vesselMl: number;
  logs: number[];
  weightKg: number | null;
  medicalRestriction: boolean;
}

/** Today's fills and the inputs of the water target. The card computes target and pace itself. */
export async function loadWaterToday(userId: string, now = new Date()): Promise<WaterState> {
  const supabase = await createClient();
  const { date } = localDay(now);
  const [{ data: profile, error: pe }, { data: logs, error: le }] = await Promise.all([
    supabase.from("profiles").select("weight_kg, water_vessel_ml, safety_flags").eq("user_id", userId).maybeSingle(),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("date", date).order("logged_at"),
  ]);
  if (pe) throw new Error(pe.message);
  if (le) throw new Error(le.message);

  const answers = (profile?.safety_flags as { answers?: Record<string, boolean | null> } | null)?.answers ?? {};
  return {
    vesselMl: profile?.water_vessel_ml ?? DEFAULT_VESSEL_ML,
    logs: (logs ?? []).map((l) => l.amount_ml),
    weightKg: profile?.weight_kg ? Number(profile.weight_kg) : null,
    medicalRestriction: Boolean(answers.medical_condition || answers.medical_restriction),
  };
}
