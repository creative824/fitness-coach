import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/he";
import { authErrorMessage } from "./errors";

const e = getDictionary().auth.errors;

describe("auth error messages", () => {
  it("explains mailer failures instead of a generic error", () => {
    expect(authErrorMessage("email_address_not_authorized")).toBe(e.email_send_failed);
    expect(authErrorMessage("unexpected_failure")).toBe(e.email_send_failed);
    expect(authErrorMessage("over_email_send_rate_limit")).toBe(e.over_request_rate_limit);
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(authErrorMessage("something_new")).toBe(e.generic);
    expect(authErrorMessage(undefined)).toBe(e.generic);
  });
});
