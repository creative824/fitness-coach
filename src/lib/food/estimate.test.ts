import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { classifyGeminiError, estimateMeal } from "./estimate";

const reply = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
const good = { not_food: false, items: [{ item_name: "חביתה", kcal_min: 150, kcal_max: 200, protein_g: 12, carbs_g: 1, fat_g: 11, confidence: "medium" }] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Gemini errors", () => {
  it("tells a bad key from a busy or missing model", () => {
    expect(classifyGeminiError(400, '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}')).toBe("bad_key");
    expect(classifyGeminiError(403, "PERMISSION_DENIED")).toBe("bad_key");
    expect(classifyGeminiError(404, "")).toBe("next_model");
    expect(classifyGeminiError(429, "RESOURCE_EXHAUSTED")).toBe("busy");
    expect(classifyGeminiError(503, "UNAVAILABLE")).toBe("busy");
    expect(classifyGeminiError(400, "Unknown name thinkingConfig")).toBe("next_model");
  });

  it("moves to the next model when one is over quota, and trims the key", async () => {
    vi.stubEnv("GEMINI_API_KEY", ' "abc" \n');
    const calls: { url: string; key: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, key: new Headers(init.headers).get("x-goog-api-key") });
        return calls.length === 1 ? new Response("RESOURCE_EXHAUSTED", { status: 429 }) : reply(good);
      }),
    );
    const r = await estimateMeal("חביתה");
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].key).toBe("abc");
    expect(calls[0].url).not.toBe(calls[1].url);
  });

  it("stops at once on a bad key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "abc");
    const f = vi.fn(async () => new Response('{"error":{"message":"API key not valid."}}', { status: 400 }));
    vi.stubGlobal("fetch", f);
    expect(await estimateMeal("חביתה")).toEqual({ ok: false, reason: "bad_key" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("says busy when every model is over quota", async () => {
    vi.stubEnv("GEMINI_API_KEY", "abc");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    expect(await estimateMeal("חביתה")).toEqual({ ok: false, reason: "busy" });
  });
});
