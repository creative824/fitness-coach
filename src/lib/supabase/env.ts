/**
 * Public Supabase settings. Newer projects call the browser key "publishable";
 * older ones call it "anon". Either works; both are safe to expose by design (RLS protects data).
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanKey(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return supabaseEnv() !== null;
}

// Whitespace, quotes and invisible direction marks that sneak in when a value is copied from a dashboard
// (especially in a right-to-left UI). Any of these makes the request fail before it reaches Supabase.
const JUNK = /[\s"'`​-‏‪-‮⁦-⁩﻿]/g;

/** Removes pasted junk from an API key. */
export function cleanKey(raw: string | undefined): string | undefined {
  const key = raw?.replace(JUNK, "");
  return key || undefined;
}

/**
 * Normalises the project URL: strips pasted junk and any path (e.g. "/rest/v1/"), and accepts the
 * dashboard link or a bare host by turning it into https://<ref>.supabase.co.
 */
export function cleanSupabaseUrl(raw: string | undefined): string | undefined {
  const value = raw?.replace(JUNK, "");
  if (!value) return undefined;
  const dashboard = value.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboard) return `https://${dashboard[1].toLowerCase()}.supabase.co`;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.origin;
  } catch {
    return undefined;
  }
}
