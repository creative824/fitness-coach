import { describe, expect, it } from "vitest";
import { parseIntent } from "./intent";

describe("telegram intents", () => {
  it("reads link codes from /start or as a plain message", () => {
    expect(parseIntent("/start ABCD2345")).toEqual({ kind: "link", code: "ABCD2345" });
    expect(parseIntent("abcd-2345")).toEqual({ kind: "link", code: "ABCD2345" });
    expect(parseIntent("/start")).toEqual({ kind: "start" });
    expect(parseIntent("/start hello")).toEqual({ kind: "start" });
  });

  it("understands the spec's example messages", () => {
    expect(parseIntent("אכלתי סנדוויץ' עם טונה")).toEqual({ kind: "food", text: "סנדוויץ' עם טונה" });
    expect(parseIntent("עשיתי 20 דקות הליכה")).toMatchObject({ kind: "activity", minutes: 20, activity: "walk" });
    expect(parseIntent("שתיתי 500 מ״ל מים")).toEqual({ kind: "water", ml: 500 });
    expect(parseIntent("מה נשאר לי היום?")).toEqual({ kind: "remaining" });
    expect(parseIntent("כמה קלוריות אכלתי היום?")).toEqual({ kind: "calories" });
  });

  it("reads other ways to say water and activity", () => {
    expect(parseIntent("שתיתי ליטר וחצי מים")).toEqual({ kind: "water", ml: 1500 });
    expect(parseIntent("שתיתי 2 כוסות מים", 300)).toEqual({ kind: "water", ml: 600 });
    expect(parseIntent("שתיתי בקבוק מים")).toEqual({ kind: "water", ml: 500 });
    expect(parseIntent("רצתי חצי שעה")).toMatchObject({ kind: "activity", minutes: 30, activity: "run" });
    expect(parseIntent("התאמנתי")).toMatchObject({ kind: "activity", activity: "workout" });
  });

  it("does not mistake food with drinks for water", () => {
    expect(parseIntent("שתיתי קפה עם חלב")).toEqual({ kind: "food", text: "קפה עם חלב" });
  });

  it("knows unlink and help", () => {
    expect(parseIntent("/unlink")).toEqual({ kind: "unlink" });
    expect(parseIntent("נתק")).toEqual({ kind: "unlink" });
    expect(parseIntent("/help")).toEqual({ kind: "help" });
  });
});
