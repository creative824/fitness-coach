import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface CurrentUser {
  id: string;
  email: string | null;
  isAdmin: boolean;
}

/**
 * Data Access Layer entry point: verifies the session on the server and returns a narrow user.
 * The proxy already redirects anonymous visitors; this is the second, authoritative check.
 */
export async function requireUser(): Promise<CurrentUser> {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const appMeta = (claims.app_metadata ?? {}) as { role?: string };
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null, isAdmin: appMeta.role === "admin" };
}
