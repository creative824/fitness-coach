"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDictionary } from "@/lib/i18n/he";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { authErrorMessage, authErrorWithRef } from "./errors";
import { requestOrigin } from "./origin";
import { safeNext } from "./routes";

export type AuthFormState = { error?: string; message?: string; email?: string } | undefined;

const t = getDictionary();
const email = z.email().max(254);
const password = z.string().min(8).max(72);

function notConfigured(): AuthFormState {
  return { error: t.auth.notConfigured };
}

export async function signIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return notConfigured();
  const parsed = z.object({ email, password: z.string().min(1).max(72) }).safeParse({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (!parsed.success) return { error: t.auth.errors.invalid_credentials, email: String(form.get("email") ?? "") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorWithRef(error), email: parsed.data.email };

  redirect(safeNext(String(form.get("next") ?? "")));
}

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return notConfigured();
  const rawEmail = String(form.get("email") ?? "").trim();
  if (form.get("adult") !== "on" || form.get("terms") !== "on") {
    return { error: t.auth.errors.must_accept, email: rawEmail };
  }
  const e = email.safeParse(rawEmail);
  if (!e.success) return { error: t.auth.errors.invalid_email, email: rawEmail };
  const p = password.safeParse(String(form.get("password") ?? ""));
  if (!p.success) return { error: t.auth.errors.weak_password, email: rawEmail };

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: e.data,
    password: p.data,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/onboarding`,
      data: { accepted_terms_at: new Date().toISOString(), confirmed_adult: true },
    },
  });
  if (error) {
    // Code and status only (no email address) so the cause shows in the server logs.
    console.error("signUp failed", { code: error.code, status: error.status, name: error.name });
    return { error: authErrorWithRef(error), email: rawEmail };
  }

  // Email confirmation off (e.g. local dev): a session exists already.
  if (data.session) redirect("/onboarding");
  redirect("/check-email");
}

export async function requestPasswordReset(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return notConfigured();
  const e = email.safeParse(String(form.get("email") ?? "").trim());
  if (!e.success) return { error: t.auth.errors.invalid_email };

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(e.data, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  // Same answer whether or not the address exists, so the form can't be used to probe accounts.
  if (error && error.code?.startsWith("over_")) return { error: authErrorMessage(error.code) };
  return { message: t.auth.forgotSent };
}

export async function updatePassword(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return notConfigured();
  const p = password.safeParse(String(form.get("password") ?? ""));
  if (!p.success) return { error: t.auth.errors.weak_password };
  if (form.get("password") !== form.get("confirm")) return { error: t.auth.errors.passwords_mismatch };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: p.data });
  if (error) return { error: authErrorMessage(error.code) };
  redirect("/today");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
