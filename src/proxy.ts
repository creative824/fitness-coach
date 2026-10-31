import { NextResponse, type NextRequest } from "next/server";
import { isGuestOnly, isProtected } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy-session";

export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (!claims && isProtected(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (claims && isGuestOnly(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
