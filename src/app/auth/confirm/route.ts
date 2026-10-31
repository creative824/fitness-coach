import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for email links (sign-up verification, password reset).
 * Supports both the default PKCE link (?code=) and the token-hash template (?token_hash=&type=).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const dest = url.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = next.split("?")[0];
  } else {
    dest.pathname = "/login";
    dest.searchParams.set("error", "link");
  }
  return NextResponse.redirect(dest);
}
