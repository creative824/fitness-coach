"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/he";
import { Field, FormAlert } from "./auth-shell";

const t = getDictionary();

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const linkError = params.get("error") === "link";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {linkError && !state ? <FormAlert kind="error">{t.auth.linkInvalid}</FormAlert> : null}
      {state?.error ? <FormAlert kind="error">{state.error}</FormAlert> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field id="email" label={t.auth.email} type="email" autoComplete="email" defaultValue={state?.email} />
      <Field id="password" label={t.auth.password} type="password" autoComplete="current-password" />
      <Button type="submit" disabled={pending}>
        {pending ? t.common.loading : t.auth.loginCta}
      </Button>
      <Link href="/forgot-password" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
        {t.auth.forgot}
      </Link>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error ? <FormAlert kind="error">{state.error}</FormAlert> : null}
      <Field id="email" label={t.auth.email} type="email" autoComplete="email" defaultValue={state?.email} />
      <Field
        id="password"
        label={t.auth.password}
        type="password"
        autoComplete="new-password"
        hint={t.auth.passwordHint}
        minLength={8}
      />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="adult" required className="mt-0.5 size-5 accent-brand" />
        <span>{t.auth.confirmAge}</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 size-5 accent-brand" />
        <span>
          {t.auth.acceptTerms}
          <Link href="/terms" target="_blank" className="font-medium text-brand underline">
            {t.auth.termsLink}
          </Link>{" "}
          {t.auth.and}
          <Link href="/privacy" target="_blank" className="font-medium text-brand underline">
            {t.auth.privacyLink}
          </Link>
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? t.common.loading : t.auth.signupCta}
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, undefined);
  if (state?.message) return <FormAlert kind="info">{state.message}</FormAlert>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-ink-muted">{t.auth.forgotBody}</p>
      {state?.error ? <FormAlert kind="error">{state.error}</FormAlert> : null}
      <Field id="email" label={t.auth.email} type="email" autoComplete="email" />
      <Button type="submit" disabled={pending}>
        {pending ? t.common.loading : t.auth.forgotCta}
      </Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error ? <FormAlert kind="error">{state.error}</FormAlert> : null}
      <Field id="password" label={t.auth.password} type="password" autoComplete="new-password" hint={t.auth.passwordHint} minLength={8} />
      <Field id="confirm" label={t.auth.passwordConfirm} type="password" autoComplete="new-password" minLength={8} />
      <Button type="submit" disabled={pending}>
        {pending ? t.common.loading : t.auth.resetCta}
      </Button>
    </form>
  );
}
