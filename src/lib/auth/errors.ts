import { getDictionary } from "@/lib/i18n/he";

type ErrorKey = keyof ReturnType<typeof getDictionary>["auth"]["errors"];

/** Maps Supabase auth error codes to Hebrew messages. Unknown codes get a generic message (never raw text). */
export function authErrorMessage(code: string | undefined | null): string {
  const e = getDictionary().auth.errors;
  const map: Record<string, ErrorKey> = {
    invalid_credentials: "invalid_credentials",
    email_not_confirmed: "email_not_confirmed",
    user_already_exists: "user_already_exists",
    email_exists: "user_already_exists",
    weak_password: "weak_password",
    over_request_rate_limit: "over_request_rate_limit",
    over_email_send_rate_limit: "over_request_rate_limit",
    email_address_invalid: "invalid_email",
    validation_failed: "invalid_email",
    // Supabase's built-in mailer only sends to project team members until custom SMTP is set up.
    email_address_not_authorized: "email_send_failed",
    unexpected_failure: "email_send_failed",
    signup_disabled: "signups_disabled",
    email_provider_disabled: "signups_disabled",
  };
  return e[map[code ?? ""] ?? "generic"];
}

/**
 * Like authErrorMessage, but an unrecognised error carries a short reference
 * (Supabase code, HTTP status or error type) so the cause can be diagnosed from a screenshot.
 * The reference never contains user data.
 */
export function authErrorWithRef(err: { code?: string; status?: number; name?: string }): string {
  const msg = authErrorMessage(err.code);
  if (msg !== getDictionary().auth.errors.generic) return msg;
  const ref = [err.code, err.status, err.name].filter((x) => x !== undefined && x !== "" && x !== 0).join(" · ");
  return ref ? `${msg} (${ref})` : msg;
}
