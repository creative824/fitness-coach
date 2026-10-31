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
  };
  return e[map[code ?? ""] ?? "generic"];
}
