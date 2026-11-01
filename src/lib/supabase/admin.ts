import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanKey, supabaseEnv } from "./env";

/**
 * Service-role client, used only by the Telegram webhook, where there is no signed-in browser
 * session. It bypasses RLS, so every query must filter by the linked user's id. Null when the
 * key is not set, and then the bot answers that it is not available yet.
 */
export function createAdminClient(): SupabaseClient | null {
  const env = supabaseEnv();
  const key = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!env || !key) return null;
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
