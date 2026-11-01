import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateMeal } from "@/lib/food/estimate";
import { totalsOf, type FoodItem } from "@/lib/food/items";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_VESSEL_ML, dailyWaterTargetMl } from "@/lib/water/plan";
import { localDay } from "@/lib/water/time";
import { send, tg } from "./api";
import { parseIntent, type Intent } from "./intent";

/**
 * Handles one Telegram update (follow-up spec §9). The bot is another way into the same
 * account: every write goes to the same tables as the site, under the linked user's id.
 * Before a chat is linked, the bot shares nothing but how to link.
 */

export interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { id: number }; text?: string };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { chat: { id: number }; message_id: number; text?: string } };
}

const TASK_POINTS_NOTE = "נק׳";
const HELP = `אפשר לכתוב לי במילים פשוטות, למשל:
• אכלתי סנדוויץ' עם טונה
• עשיתי 20 דקות הליכה
• שתיתי 500 מ״ל מים
• מה נשאר לי היום?
• כמה קלוריות אכלתי היום?

כל מה שנרשם כאן מופיע גם באתר. לניתוק: /unlink`;
const NOT_LINKED = `כדי להתחיל צריך לחבר את הבוט לחשבון שלך ב-trAIning:
באתר נכנסים לפרופיל ← "חבר Telegram", ושולחים לכאן את הקוד שמופיע שם. הקוד תקף ל-10 דקות.`;

export const hashCode = (code: string) => createHash("sha256").update(code.toUpperCase()).digest("hex");

export async function handleUpdate(update: TgUpdate): Promise<void> {
  const db = createAdminClient();
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (!db) {
    if (chatId) await send(chatId, "הבוט עוד לא הופעל עד הסוף. נסו שוב מאוחר יותר.");
    return;
  }

  // A webhook retry carries the same update_id: handle it once.
  const { error: dup } = await db.from("telegram_updates").insert({ update_id: update.update_id });
  if (dup) {
    if (dup.code !== "23505") console.error("telegram dedup", dup.message);
    return;
  }

  if (update.callback_query) return handleCallback(db, update.callback_query);
  const msg = update.message;
  if (!msg || !msg.from || msg.chat.type !== "private") return;
  if (!msg.text) {
    await send(msg.chat.id, "כרגע אני מבין רק הודעות טקסט.");
    return;
  }

  const { data: link } = await db.from("telegram_links").select("user_id").eq("telegram_user_id", msg.from.id).maybeSingle();
  const userId = (link as { user_id: string } | null)?.user_id ?? null;
  let vessel = DEFAULT_VESSEL_ML;
  if (userId) {
    const { data: p } = await db.from("profiles").select("water_vessel_ml").eq("user_id", userId).maybeSingle();
    vessel = (p as { water_vessel_ml?: number } | null)?.water_vessel_ml ?? DEFAULT_VESSEL_ML;
  }
  const intent = parseIntent(msg.text, vessel);

  if (intent.kind === "link") {
    const { data: linked, error } = await db.rpc("telegram_link_as", {
      p_token_hash: hashCode(intent.code),
      p_telegram_user_id: msg.from.id,
      p_chat_id: msg.chat.id,
    });
    if (error) console.error("telegram link", error.message);
    await send(
      msg.chat.id,
      linked ? `מעולה, הבוט מחובר לחשבון שלך. 🎉\n\n${HELP}` : "הקוד לא תקין או שפג תוקפו. אפשר ליצור קוד חדש בפרופיל באתר.",
    );
    return;
  }
  if (!userId) {
    await send(msg.chat.id, NOT_LINKED);
    return;
  }

  // Occasionally forget old update ids; a retry never comes days later.
  if (update.update_id % 50 === 0) {
    await db.from("telegram_updates").delete().lt("received_at", new Date(Date.now() - 3 * 864e5).toISOString());
  }

  await handleIntent(db, userId, msg.chat.id, intent);
}

async function handleIntent(db: SupabaseClient, userId: string, chatId: number, intent: Intent) {
  const { date } = localDay(new Date());
  switch (intent.kind) {
    case "start":
    case "help":
      return send(chatId, HELP);
    case "link":
      return;
    case "unlink": {
      await db.from("telegram_links").delete().eq("user_id", userId);
      return send(chatId, "הבוט נותק מהחשבון. הנתונים שכבר נרשמו נשארים באתר. אפשר לחבר שוב בכל זמן מהפרופיל.");
    }
    case "water":
      return logWater(db, userId, chatId, date, intent.ml);
    case "activity":
      return logActivity(db, userId, chatId, date, intent);
    case "remaining":
      return remaining(db, userId, chatId, date);
    case "calories":
      return calories(db, userId, chatId, date);
    case "food":
      return logFood(db, userId, chatId, date, intent.text);
  }
}

type Task = { id: string; type: string; title: string; points: number; status: string };

async function todayTasks(db: SupabaseClient, userId: string, date: string): Promise<Task[]> {
  const { data } = await db
    .from("daily_tasks")
    .select("id, type, title, points, status, sort_order, plans!inner(status)")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("plans.status", "active")
    .order("sort_order");
  return (data ?? []) as unknown as Task[];
}

async function markDone(db: SupabaseClient, userId: string, task: Task): Promise<boolean> {
  const { error } = await db.rpc("set_task_outcome_as", { p_user: userId, p_task_id: task.id, p_outcome: "done" });
  if (error) console.error("telegram task", error.message);
  return !error;
}

async function logWater(db: SupabaseClient, userId: string, chatId: number, date: string, ml: number) {
  if (ml < 50 || ml > 3000) return send(chatId, "אפשר לרשום בין 50 ל-3,000 מ״ל בכל הודעה.");
  // The site stores up to 2 litres per row; a larger amount is split.
  const rows = ml > 2000 ? [2000, ml - 2000].filter((v) => v >= 50) : [ml];
  const { error } = await db.from("water_logs").insert(rows.map((amount_ml) => ({ user_id: userId, date, amount_ml })));
  if (error) return send(chatId, "לא הצלחתי לרשום את המים. נסו שוב בעוד רגע.");

  const [{ data: logs }, { data: profile }, tasks] = await Promise.all([
    db.from("water_logs").select("amount_ml").eq("user_id", userId).eq("date", date),
    db.from("profiles").select("weight_kg, safety_flags").eq("user_id", userId).maybeSingle(),
    todayTasks(db, userId, date),
  ]);
  const total = (logs ?? []).reduce((s, l) => s + (l as { amount_ml: number }).amount_ml, 0);
  const p = profile as { weight_kg: number | null; safety_flags: { answers?: Record<string, boolean | null> } | null } | null;
  const answers = p?.safety_flags?.answers ?? {};
  const target = dailyWaterTargetMl({
    weightKg: p?.weight_kg ? Number(p.weight_kg) : null,
    workoutToday: tasks.some((t) => t.type === "workout"),
    medicalRestriction: Boolean(answers.medical_condition || answers.medical_restriction),
  });
  let extra = "";
  const waterTask = tasks.find((t) => t.type === "water" && t.status === "pending");
  if (target && total >= target && waterTask && (await markDone(db, userId, waterTask))) {
    extra = `\nהגעת ליעד המים של היום! +${waterTask.points} ${TASK_POINTS_NOTE} 💧`;
  }
  const progress = target ? ` מתוך כ-${target.toLocaleString("he-IL")} מ״ל` : "";
  return send(chatId, `נרשמו ${ml.toLocaleString("he-IL")} מ״ל. היום שתית ${total.toLocaleString("he-IL")} מ״ל${progress}.${extra}`);
}

async function logActivity(db: SupabaseClient, userId: string, chatId: number, date: string, a: Extract<Intent, { kind: "activity" }>) {
  const tasks = await todayTasks(db, userId, date);
  const want = a.activity === "workout" ? "workout" : "movement";
  const task = tasks.find((t) => t.type === want && t.status === "pending");
  const { error } = await db.from("exercise_logs").insert({
    user_id: userId,
    date,
    task_id: task?.id ?? null,
    sets: a.minutes ? [{ seconds: a.minutes * 60 }] : [],
    notes: `טלגרם: ${a.label}${a.minutes ? ` ${a.minutes} דק׳` : ""}`,
  });
  if (error) return send(chatId, "לא הצלחתי לרשום את הפעילות. נסו שוב בעוד רגע.");
  const what = a.minutes ? `${a.label} של ${a.minutes} דקות` : a.label;
  if (task && (await markDone(db, userId, task))) {
    return send(chatId, `כל הכבוד! רשמתי ${what}, והמשימה "${task.title}" סומנה כבוצעה. +${task.points} ${TASK_POINTS_NOTE}`);
  }
  return send(chatId, `כל הכבוד! רשמתי ${what} ביומן.`);
}

async function tracking(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from("profiles").select("calorie_tracking").eq("user_id", userId).maybeSingle();
  return (data as { calorie_tracking?: boolean } | null)?.calorie_tracking !== false;
}

type ItemRow = Pick<FoodItem, "kcal_min" | "kcal_max" | "protein_g" | "carbs_g" | "fat_g">;
async function confirmedItems(db: SupabaseClient, userId: string, date: string) {
  const { data } = await db
    .from("food_logs")
    .select("id, food_log_items(kcal_min, kcal_max, protein_g, carbs_g, fat_g)")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("status", "confirmed");
  const logs = (data ?? []) as unknown as { food_log_items: ItemRow[] }[];
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const items = logs.flatMap((l) =>
    l.food_log_items.map((i) => ({ kcal_min: n(i.kcal_min), kcal_max: n(i.kcal_max), protein_g: n(i.protein_g), carbs_g: n(i.carbs_g), fat_g: n(i.fat_g) })),
  );
  return { meals: logs.length, totals: totalsOf(items) };
}

async function remaining(db: SupabaseClient, userId: string, chatId: number, date: string) {
  const [tasks, food] = await Promise.all([todayTasks(db, userId, date), confirmedItems(db, userId, date)]);
  if (!tasks.length) return send(chatId, "אין תוכנית פעילה להיום. אפשר ליצור אותה באתר.");
  const open = tasks.filter((t) => t.status === "pending");
  const done = tasks.length - open.length;
  const workout = tasks.find((t) => t.type === "workout");
  const lines = [
    open.length ? `נשארו ${open.length} משימות (סיימת ${done} מתוך ${tasks.length}):` : `סיימת את כל ${tasks.length} המשימות של היום! 🎉`,
    ...open.map((t) => `• ${t.title}`),
    "",
    workout ? (workout.status === "pending" ? `אימון: ${workout.title}, עוד מחכה לך.` : "אימון: בוצע ✔") : "היום אין אימון בתוכנית.",
    `ארוחות שנרשמו היום: ${food.meals}`,
  ];
  return send(chatId, lines.join("\n"));
}

async function calories(db: SupabaseClient, userId: string, chatId: number, date: string) {
  if (!(await tracking(db, userId))) return send(chatId, "מעקב הקלוריות כבוי בהגדרות שלך, אז אני לא מציג מספרים. אפשר להפעיל אותו בפרופיל באתר.");
  const { meals, totals } = await confirmedItems(db, userId, date);
  if (!meals || !totals.kcal) return send(chatId, "עוד אין היום ארוחות מאושרות עם הערכה.");
  const macros =
    totals.protein !== null ? `\nבערך: חלבון ${totals.protein} ג׳ · פחמימות ${totals.carbs ?? "–"} ג׳ · שומן ${totals.fat ?? "–"} ג׳` : "";
  return send(
    chatId,
    `לפי ${meals} ארוחות שאישרת היום: בערך ${totals.kcal[0]}–${totals.kcal[1]} קלוריות.${macros}\n\nזו הערכה לפי הדיווח שלך, לא מדידה מדויקת.`,
  );
}

function itemLine(i: FoodItem, numbers: boolean) {
  const qty = i.quantity ? ` (${i.quantity}${i.unit ? ` ${i.unit}` : ""})` : "";
  const kcal = numbers && i.kcal_min !== null ? ` · ${i.kcal_min}–${i.kcal_max} קל׳` : "";
  return `• ${i.item_name}${qty}${kcal}`;
}

async function logFood(db: SupabaseClient, userId: string, chatId: number, date: string, text: string) {
  const numbers = await tracking(db, userId);
  const est = numbers ? await estimateMeal(text) : null;
  if (est && !est.ok && est.reason === "not_food") return send(chatId, `לא בטוח שהבנתי. ${HELP}`);
  const items = est?.ok ? est.items : [];
  const { data: id, error } = await db.rpc("save_food_log_as", {
    p_user: userId,
    p_date: date,
    p_text: text,
    p_estimated: items.length > 0,
    p_items: items,
  });
  if (error || !id) {
    console.error("telegram food", error?.message);
    return send(chatId, "לא הצלחתי לשמור את הארוחה. נסו שוב בעוד רגע.");
  }
  const t = totalsOf(items);
  const lines = items.length
    ? [
        "זה מה שהבנתי:",
        ...items.map((i) => itemLine(i, numbers)),
        ...(numbers && t.kcal ? ["", `סה״כ בערך ${t.kcal[0]}–${t.kcal[1]} קלוריות (הערכה בלבד).`] : []),
        ...(est?.ok && est.question ? ["", `❓ ${est.question}`, "אפשר לשלוח שוב עם הפרט הזה, או לתקן באתר."] : []),
      ]
    : [`רשמתי: "${text}".`, numbers ? "את הפריטים אפשר להוסיף באתר." : ""];
  return send(chatId, lines.filter((l, i, a) => l || a[i - 1]).join("\n").trim(), [
    [
      { text: "✅ אשר ושמור", callback_data: `fc:${id}` },
      { text: "🗑 מחק", callback_data: `fd:${id}` },
    ],
  ]);
}

async function handleCallback(db: SupabaseClient, q: NonNullable<TgUpdate["callback_query"]>) {
  const m = q.data?.match(/^(fc|fd):([0-9a-f-]{36})$/);
  const { data: link } = await db.from("telegram_links").select("user_id").eq("telegram_user_id", q.from.id).maybeSingle();
  const userId = (link as { user_id: string } | null)?.user_id;
  if (!m || !userId || !q.message) {
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: userId ? "" : "הבוט לא מחובר לחשבון." });
    return;
  }
  const [, action, id] = m;
  const res =
    action === "fc"
      ? await db.from("food_logs").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select("id")
      : await db.from("food_logs").delete().eq("id", id).eq("user_id", userId).select("id");
  const ok = !res.error && (res.data?.length ?? 0) > 0;
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: ok ? (action === "fc" ? "נשמר" : "נמחק") : "הארוחה כבר לא קיימת" });
  if (ok) {
    await tg("editMessageText", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: `${q.message.text ?? ""}\n\n${action === "fc" ? "✅ נשמר ביומן האוכל." : "🗑 נמחק."}`,
    });
  }
}
