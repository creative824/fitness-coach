import { describe, expect, it } from "vitest";
import { cleanKey, cleanSupabaseUrl } from "./env";

const URL = "https://abcref.supabase.co";

describe("cleanSupabaseUrl", () => {
  it("keeps a correct URL", () => expect(cleanSupabaseUrl(URL)).toBe(URL));
  it("strips whitespace, quotes and direction marks", () =>
    expect(cleanSupabaseUrl(` "‏${URL}\n" `)).toBe(URL));
  it("drops a trailing path", () => expect(cleanSupabaseUrl(`${URL}/rest/v1/`)).toBe(URL));
  it("adds https to a bare host", () => expect(cleanSupabaseUrl("abcref.supabase.co")).toBe(URL));
  it("accepts the dashboard link", () =>
    expect(cleanSupabaseUrl("https://supabase.com/dashboard/project/abcref/settings/api")).toBe(URL));
  it("rejects empty values", () => expect(cleanSupabaseUrl("  ")).toBeUndefined());
});

describe("cleanKey", () => {
  it("strips whitespace and invisible marks", () => expect(cleanKey("‎ ey.J.x \n")).toBe("ey.J.x"));
  it("treats blank as missing", () => expect(cleanKey(" \n")).toBeUndefined());
});
