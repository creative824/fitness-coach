"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { addDays } from "@/lib/plan/week";
import { hashInviteCode, newInviteCode, normaliseCode } from "./code";
import { DURATIONS, KINDS } from "./rules";

const nickname = z.string().trim().min(1).max(30);

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(KINDS),
  days: z.union(DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<30>]),
  startTomorrow: z.boolean(),
  nickname,
});

export type CreateResult = { ok: true; id: string; code: string } | { ok: false; reason: "invalid" | "limit" | "failed" };

/** Creates a competition. The invite code is returned once; only its hash is stored. */
export async function createCompetition(input: z.input<typeof createSchema>): Promise<CreateResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  await requireUser();
  const d = parsed.data;
  const today = localDay(new Date()).date;
  const start = d.startTomorrow ? addDays(today, 1) : today;
  const code = newInviteCode();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_leaderboard", {
    p_name: d.name,
    p_kind: d.kind,
    p_start: start,
    p_end: addDays(start, d.days - 1),
    p_display_name: d.nickname,
    p_code_hash: hashInviteCode(code),
  });
  if (error || !data) {
    console.error("create_leaderboard failed", error?.message);
    return {
      ok: false,
      reason: error?.message.includes("too many") ? "limit" : "failed",
    };
  }
  revalidatePath("/competitions");
  return { ok: true, id: data as string, code };
}

export type JoinResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: "invalid" | "wrong_code" | "full" | "over" | "removed" | "limit" | "failed";
    };

export async function joinCompetition(input: { code: string; nickname: string }): Promise<JoinResult> {
  const code = normaliseCode(input.code ?? "");
  const name = nickname.safeParse(input.nickname);
  if (!code || !name.success) return { ok: false, reason: "invalid" };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_leaderboard", {
    p_code_hash: hashInviteCode(code),
    p_display_name: name.data,
  });
  if (error) {
    const m = error.message;
    const reason = m.includes("full")
      ? "full"
      : m.includes("over")
        ? "over"
        : m.includes("removed")
          ? "removed"
          : m.includes("too many")
            ? "limit"
            : "failed";
    if (reason === "failed") console.error("join_leaderboard failed", m);
    return { ok: false, reason };
  }
  if (!data) return { ok: false, reason: "wrong_code" };
  revalidatePath("/competitions");
  return { ok: true, id: data as string };
}

const id = z.uuid();

/** A new invite code for the owner. The previous code stops working. */
export async function rotateInviteCode(competitionId: string): Promise<{ ok: true; code: string } | { ok: false }> {
  if (!id.safeParse(competitionId).success) return { ok: false };
  await requireUser();
  const code = newInviteCode();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leaderboard_rotate_code", {
    p_id: competitionId,
    p_code_hash: hashInviteCode(code),
  });
  if (error) return { ok: false };
  return { ok: true, code };
}

export async function removeMember(competitionId: string, memberKey: string): Promise<{ ok: boolean }> {
  if (!id.safeParse(competitionId).success || !/^[0-9a-f]{32}$/.test(memberKey)) return { ok: false };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leaderboard_remove_member", {
    p_id: competitionId,
    p_member_key: memberKey,
  });
  revalidatePath(`/competitions/${competitionId}`);
  return { ok: !error };
}

export async function leaveCompetition(competitionId: string): Promise<{ ok: boolean }> {
  if (!id.safeParse(competitionId).success) return { ok: false };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_leaderboard", {
    p_id: competitionId,
  });
  revalidatePath("/competitions");
  return { ok: !error };
}

export async function cancelCompetition(competitionId: string): Promise<{ ok: boolean }> {
  if (!id.safeParse(competitionId).success) return { ok: false };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leaderboard_cancel", {
    p_id: competitionId,
  });
  revalidatePath("/competitions");
  revalidatePath(`/competitions/${competitionId}`);
  return { ok: !error };
}
