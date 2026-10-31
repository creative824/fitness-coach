/** Route access rules, shared by the proxy and tests. */
export const PROTECTED_PREFIXES = ["/today", "/plan", "/coach", "/progress", "/profile", "/onboarding", "/admin"] as const;
export const GUEST_ONLY = ["/login", "/signup", "/forgot-password"] as const;

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function isProtected(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => matches(path, p));
}

export function isGuestOnly(path: string): boolean {
  return GUEST_ONLY.some((p) => matches(path, p));
}

/** Only same-site relative paths are accepted as a post-login destination (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/today"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
