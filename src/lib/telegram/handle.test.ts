import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// A tiny stand-in for the service-role client: records calls and answers from a table map.
type Call = { table?: string; rpc?: string; op: string; args: unknown[] };
let calls: Call[];
let tables: Record<string, unknown[]>;
let insertError: Record<string, { code: string; message: string } | null>;
let rpcResult: Record<string, unknown>;

function query(table: string) {
  const q: Record<string, unknown> = {};
  const chain = (op: string) => (...args: unknown[]) => {
    calls.push({ table, op, args });
    return q;
  };
  for (const op of ["select", "eq", "lt", "is", "order", "delete", "update", "gte", "lte"]) q[op] = chain(op);
  q.insert = (...args: unknown[]) => {
    calls.push({ table, op: "insert", args });
    return Promise.resolve({ error: insertError[table] ?? null });
  };
  q.maybeSingle = () => Promise.resolve({ data: tables[table]?.[0] ?? null, error: null });
  q.then = (res: (v: unknown) => void) => res({ data: tables[table] ?? [], error: null });
  return q;
}
const fakeDb = {
  from: (t: string) => query(t),
  rpc: (name: string, args: unknown) => {
    calls.push({ rpc: name, op: "rpc", args: [args] });
    return Promise.resolve({ data: rpcResult[name] ?? null, error: null });
  },
};
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeDb }));

const sent: { chat: number; text: string }[] = [];
vi.mock("./api", () => ({
  send: (chat: number, text: string) => {
    sent.push({ chat, text });
    return Promise.resolve({ ok: true });
  },
  tg: () => Promise.resolve({ ok: true }),
}));
vi.mock("@/lib/food/estimate", () => ({
  estimateMeal: () =>
    Promise.resolve({ ok: true, question: null, items: [{ item_name: "טונה", quantity: null, unit: null, preparation: null, kcal_min: 300, kcal_max: 420, protein_g: 25, carbs_g: 40, fat_g: 10, confidence: "medium" }] }),
}));

const { handleUpdate, hashCode } = await import("./handle");

const msg = (update_id: number, text: string) => ({ update_id, message: { chat: { id: 5, type: "private" }, from: { id: 9 }, text } });

beforeEach(() => {
  calls = [];
  tables = {};
  insertError = {};
  rpcResult = {};
  sent.length = 0;
});

describe("telegram bot", () => {
  it("handles a retried update only once", async () => {
    insertError.telegram_updates = { code: "23505", message: "duplicate" };
    await handleUpdate(msg(1, "מה נשאר לי היום?"));
    expect(sent).toHaveLength(0);
  });

  it("shares nothing before the chat is linked", async () => {
    await handleUpdate(msg(2, "כמה קלוריות אכלתי היום?"));
    expect(sent[0].text).toContain("לחבר את הבוט");
    expect(calls.some((c) => c.table === "food_logs")).toBe(false);
  });

  it("links with a one-time code, sending only its hash", async () => {
    rpcResult.telegram_link_as = "user-1";
    await handleUpdate(msg(3, "/start ABCD2345"));
    const call = calls.find((c) => c.rpc === "telegram_link_as");
    expect(call?.args[0]).toMatchObject({ p_token_hash: hashCode("ABCD2345"), p_telegram_user_id: 9 });
    expect(JSON.stringify(call?.args)).not.toContain("ABCD2345");
    expect(sent[0].text).toContain("מחובר");
  });

  it("saves a meal from a linked chat as a draft in the same account", async () => {
    tables.telegram_links = [{ user_id: "user-1" }];
    tables.profiles = [{ calorie_tracking: true, water_vessel_ml: 250 }];
    rpcResult.save_food_log_as = "11111111-1111-4111-8111-111111111111";
    await handleUpdate(msg(4, "אכלתי סנדוויץ' עם טונה"));
    const call = calls.find((c) => c.rpc === "save_food_log_as");
    expect(call?.args[0]).toMatchObject({ p_user: "user-1", p_estimated: true });
    expect(sent[0].text).toContain("300–420");
    expect(sent[0].text).toContain("הערכה");
  });

  it("still saves the meal, without an estimate, over the daily AI limit", async () => {
    tables.telegram_links = [{ user_id: "user-1" }];
    tables.profiles = [{ calorie_tracking: true, water_vessel_ml: 250 }];
    rpcResult.take_ai_quota_as = false;
    rpcResult.save_food_log_as = "11111111-1111-4111-8111-111111111111";
    await handleUpdate(msg(6, "אכלתי סנדוויץ' עם טונה"));
    const quota = calls.find((c) => c.rpc === "take_ai_quota_as");
    expect(quota?.args[0]).toMatchObject({ p_user: "user-1", p_kind: "food_estimate" });
    const call = calls.find((c) => c.rpc === "save_food_log_as");
    expect(call?.args[0]).toMatchObject({ p_user: "user-1", p_estimated: false });
    expect(sent[0].text).not.toContain("300–420");
  });

  it("unlinks on request", async () => {
    tables.telegram_links = [{ user_id: "user-1" }];
    await handleUpdate(msg(5, "/unlink"));
    expect(calls.some((c) => c.table === "telegram_links" && c.op === "delete")).toBe(true);
    expect(sent[0].text).toContain("נותק");
  });
});
