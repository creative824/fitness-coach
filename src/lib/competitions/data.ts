import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { statusOf, type Kind, type Status } from "./rules";

export interface Competition {
  id: string;
  name: string;
  kind: Kind;
  start_date: string;
  end_date: string;
  max_members: number;
  cancelled_at: string | null;
  finalized_at: string | null;
  isOwner: boolean;
  status: Status;
}

export interface Standing {
  member_key: string;
  display_name: string;
  is_me: boolean;
  is_owner: boolean;
  done: number;
  planned: number;
  score: number | null;
  rank: number | null;
}

const COLS = "id, name, kind, owner_id, start_date, end_date, max_members, cancelled_at, finalized_at";
type Row = Omit<Competition, "isOwner" | "status"> & { owner_id: string };

function toCompetition(r: Row, userId: string, today: string): Competition {
  const { owner_id, ...rest } = r;
  return { ...rest, isOwner: owner_id === userId, status: statusOf(r, today) };
}

/** The competitions the user is an active member of (RLS returns only those). */
export async function listCompetitions(userId: string): Promise<Competition[]> {
  const supabase = await createClient();
  const today = localDay(new Date()).date;
  const { data, error } = await supabase.from("leaderboards").select(COLS).order("end_date", { ascending: false });
  if (error) {
    console.error("listCompetitions", error.message);
    return [];
  }
  return (data as Row[]).map((r) => toCompetition(r, userId, today));
}

export interface CompetitionView {
  competition: Competition;
  standings: Standing[];
  results: {
    display_name: string;
    rank: number;
    score: number | null;
    prize_points: number;
    is_me: boolean;
  }[];
}

/** One competition with its standings. Finalizes it first when its end date has passed. */
export async function loadCompetition(userId: string, id: string): Promise<CompetitionView | null> {
  const supabase = await createClient();
  const today = localDay(new Date()).date;
  const { data: row } = await supabase.from("leaderboards").select(COLS).eq("id", id).maybeSingle();
  if (!row) return null;
  let competition = toCompetition(row as Row, userId, today);
  if (competition.status === "ended" && !competition.finalized_at) {
    const { data: done } = await supabase.rpc("finalize_leaderboard", {
      p_id: id,
    });
    if (done) competition = { ...competition, finalized_at: new Date().toISOString() };
  }
  const [{ data: standings }, { data: results }] = await Promise.all([
    supabase.rpc("leaderboard_standings", { p_id: id }),
    competition.finalized_at
      ? supabase
          .from("leaderboard_results")
          .select("user_id, display_name, rank, score, prize_points")
          .eq("leaderboard_id", id)
          .order("rank")
      : Promise.resolve({ data: [] }),
  ]);
  return {
    competition,
    standings: (standings ?? []) as Standing[],
    results: (
      (results ?? []) as {
        user_id: string;
        display_name: string;
        rank: number;
        score: number | null;
        prize_points: number;
      }[]
    ).map(({ user_id, ...r }) => ({ ...r, is_me: user_id === userId })),
  };
}

/** Prize points won in finished competitions, for the profile. */
export async function prizeTotal(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("leaderboard_results").select("prize_points").eq("user_id", userId);
  return (data ?? []).reduce((s, r) => s + ((r as { prize_points: number }).prize_points ?? 0), 0);
}
