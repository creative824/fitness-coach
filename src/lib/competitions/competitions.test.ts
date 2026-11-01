import { describe, expect, it } from "vitest";
import { INVITE_ALPHABET, hashInviteCode, newInviteCode, normaliseCode } from "./code";
import { KIND_INFO, KINDS, PRIZES, daysBetween, statusOf, timeLeftLabel } from "./rules";

describe("invite codes", () => {
  it("are 8 characters from the alphabet without look-alikes", () => {
    for (let i = 0; i < 50; i++) {
      const c = newInviteCode();
      expect(c).toMatch(new RegExp(`^[${INVITE_ALPHABET}]{8}$`));
    }
    expect(INVITE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("normalise case, spaces and dashes, and reject anything else", () => {
    expect(normaliseCode("abcd-2345")).toBe("ABCD2345");
    expect(normaliseCode(" abcd 2345 ")).toBe("ABCD2345");
    expect(normaliseCode("ABCD234")).toBeNull();
    expect(normaliseCode("ABCD2340")).toBeNull();
    expect(normaliseCode("ABCD'; --")).toBeNull();
  });

  it("are stored only as a sha256 hash", () => {
    const h = hashInviteCode("ABCD2345");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("ABCD2345");
    expect(hashInviteCode("ABCD2345")).toBe(h);
  });
});

describe("competition rules", () => {
  it("every kind has a formula shown before joining", () => {
    for (const k of KINDS) expect(KIND_INFO[k].formula.length).toBeGreaterThan(40);
  });

  it("prizes match the database default", () => {
    expect(PRIZES).toEqual([100, 60, 30]);
  });

  it("status follows dates, cancel and finalize", () => {
    const b = {
      start_date: "2026-11-02",
      end_date: "2026-11-15",
      cancelled_at: null,
      finalized_at: null,
    };
    expect(statusOf(b, "2026-11-01")).toBe("upcoming");
    expect(statusOf(b, "2026-11-02")).toBe("active");
    expect(statusOf(b, "2026-11-15")).toBe("active");
    expect(statusOf(b, "2026-11-16")).toBe("ended");
    expect(statusOf({ ...b, finalized_at: "x" }, "2026-11-05")).toBe("ended");
    expect(statusOf({ ...b, cancelled_at: "x" }, "2026-11-05")).toBe("cancelled");
  });

  it("counts days and says how long is left", () => {
    const b = { start_date: "2026-11-02", end_date: "2026-11-15" };
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(timeLeftLabel(b, "upcoming", "2026-11-01")).toBe("מתחילה מחר");
    expect(timeLeftLabel(b, "active", "2026-11-14")).toBe("נשאר יום אחד");
    expect(timeLeftLabel(b, "active", "2026-11-15")).toBe("היום האחרון");
    expect(timeLeftLabel(b, "active", "2026-11-05")).toBe("נשארו 10 ימים");
    expect(timeLeftLabel(b, "ended", "2026-11-20")).toBeNull();
  });
});
