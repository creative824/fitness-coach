import "server-only";
import { z } from "zod";
import { foodItemSchema, type FoodItem } from "./items";

/**
 * Estimates the items of a meal from free text with Google Gemini (free tier of Google AI
 * Studio). Only the meal text is sent: no name, email, profile or health data.
 * Without GEMINI_API_KEY the log still works; items are then entered by hand.
 */

export type EstimateResult =
  | { ok: true; items: FoodItem[]; question: string | null }
  | { ok: false; reason: "no_key" | "not_food" | "failed" | "limit" };

const MODELS = [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest"].filter(
  (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i,
);

const SYSTEM = `אתה עוזר להעריך מה אכל המשתמש מתוך תיאור חופשי בעברית.
החזר רשימת פריטים. לכל פריט: שם קצר בעברית, כמות ויחידה אם נאמרו או אם אפשר להניח באופן סביר, אופן הכנה אם רלוונטי,
טווח קלוריות משוער (kcal_min עד kcal_max, טווח ריאלי ולא מספר אחד), הערכת חלבון, פחמימות ושומן בגרמים, ורמת ודאות (low/medium/high).
אם הכמות לא ידועה, הנח מנה ממוצעת, הרחב את הטווח וסמן ודאות נמוכה.
אם חסר פרט שמשנה מאוד את ההערכה (למשל כמות, או טיגון מול אפייה), כתוב שאלת הבהרה אחת קצרה בעברית בשדה question. אחרת השאר אותו ריק.
אם הטקסט אינו תיאור של אוכל או שתייה, החזר not_food=true ורשימה ריקה.
אל תיתן ייעוץ רפואי, אל תשפוט ואל תמליץ לאכול פחות.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    not_food: { type: "BOOLEAN" },
    question: { type: "STRING", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          item_name: { type: "STRING" },
          quantity: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true },
          preparation: { type: "STRING", nullable: true },
          kcal_min: { type: "INTEGER" },
          kcal_max: { type: "INTEGER" },
          protein_g: { type: "NUMBER" },
          carbs_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
          confidence: { type: "STRING", enum: ["low", "medium", "high"] },
        },
        required: ["item_name", "kcal_min", "kcal_max", "protein_g", "carbs_g", "fat_g", "confidence"],
      },
    },
  },
  required: ["not_food", "items"],
};

const replySchema = z.object({
  not_food: z.boolean().optional().default(false),
  question: z.string().max(200).nullable().optional(),
  items: z.array(z.unknown()).max(30),
});

/** Parses the model's JSON; drops items that do not validate instead of failing the meal. */
export function parseEstimate(raw: string): EstimateResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "failed" };
  }
  const reply = replySchema.safeParse(json);
  if (!reply.success) return { ok: false, reason: "failed" };
  if (reply.data.not_food) return { ok: false, reason: "not_food" };
  const items = reply.data.items.flatMap((i) => {
    const p = foodItemSchema.safeParse(i);
    return p.success ? [p.data] : [];
  });
  if (!items.length) return { ok: false, reason: "failed" };
  const q = reply.data.question?.trim();
  return { ok: true, items, question: q ? q : null };
}

export async function estimateMeal(text: string): Promise<EstimateResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: text.slice(0, 1000) }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  });
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (res.status === 404) continue; // model name not available: try the next one
      if (!res.ok) {
        console.error("estimateMeal failed", model, res.status);
        return { ok: false, reason: "failed" };
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return parseEstimate(raw);
    } catch (e) {
      console.error("estimateMeal error", model, e instanceof Error ? e.message : e);
      return { ok: false, reason: "failed" };
    }
  }
  return { ok: false, reason: "failed" };
}
