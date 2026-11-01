import { describe, expect, it } from "vitest";
import { isGuestOnly, isProtected, safeNext } from "./routes";

describe("route rules", () => {
  it("protects the personal area, onboarding and admin", () => {
    for (const p of ["/today", "/plan", "/coach/1", "/progress", "/competitions/join", "/profile", "/onboarding", "/admin"]) {
      expect(isProtected(p)).toBe(true);
    }
    for (const p of ["/", "/login", "/privacy", "/todayish"]) expect(isProtected(p)).toBe(false);
  });

  it("marks login and signup as guest-only", () => {
    expect(isGuestOnly("/login")).toBe(true);
    expect(isGuestOnly("/signup")).toBe(true);
    expect(isGuestOnly("/reset-password")).toBe(false);
  });

  it("rejects open redirects", () => {
    expect(safeNext("/plan?x=1")).toBe("/plan?x=1");
    expect(safeNext("https://evil.example")).toBe("/today");
    expect(safeNext("//evil.example")).toBe("/today");
    expect(safeNext("/\\evil.example")).toBe("/today");
    expect(safeNext(null)).toBe("/today");
  });
});
