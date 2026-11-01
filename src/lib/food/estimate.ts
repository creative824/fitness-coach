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
  | { ok: false; reason: "no_key" | "bad_key" | "busy" | "not_food" | "failed" | "limit" };

/**
 * Tried in order. A model that is missing, retired, over its free quota or overloaded is
 * skipped, so one bad model name or one busy model does not stop the estimate.
 */
const MODELS = [
  process.env.GEMINI_MODEL?.trim(),
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
].filter((m, i, all): m is string => Boolean(m) && all.indexOf(m) === i);

/** What a failed Gemini call means for the next step. Exported for tests. */
export function classifyGeminiError(status: number, body: string): "bad_key" | "next_model" | "busy" | "failed" {
  if (
    /API_KEY_INVALID|API key not valid|API_KEY_SERVICE_BLOCKED|PERMISSION_DENIED|SERVICE_DISABLED/i.test(body) ||
    status === 401 ||
    status === 403
  ) {
    return "bad_key";
  }
  if (status === 404) return "next_model";
  if (status === 429 || status === 500 || status === 503 || status === 504) return "busy";
  // 400 for a reason other than the key: usually a model that rejects an option. Try the next.
  if (status === 400) return "next_model";
  return "failed";
}

/** Fast answers: the 2.5 models think by default, which adds seconds and can hit the timeout. */
function thinkingFor(model: string) {
  return model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {};
}

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
  // Pasted keys often carry a space, a newline or quotes.
  const key = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) return { ok: false, reason: "no_key" };
  let last: EstimateResult = { ok: false, reason: "failed" };
  for (const model of MODELS) {
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: text.slice(0, 1000) }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, ...thinkingFor(model) },
    });
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 500);
        const kind = classifyGeminiError(res.status, detail);
        console.error("estimateMeal failed", model, res.status, detail);
        if (kind === "bad_key") return { ok: false, reason: "bad_key" };
        if (kind === "failed") return { ok: false, reason: "failed" };
        if (kind === "busy") last = { ok: false, reason: "busy" };
        continue;
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const raw =
        data.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("") ?? "";
      const result = parseEstimate(raw);
      if (result.ok || result.reason === "not_food") return result;
      console.error("estimateMeal unreadable reply", model, raw.slice(0, 300));
      last = result;
    } catch (e) {
      // Timeout or network error: trying more models would only make the user wait longer.
      console.error("estimateMeal error", model, e instanceof Error ? e.message : e);
      return { ok: false, reason: "busy" };
    }
  }
  return last;
}
