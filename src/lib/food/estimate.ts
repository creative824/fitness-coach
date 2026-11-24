import "server-only";
import { foodItemSchema, type FoodItem } from "./items";
import { computeMeal, itemsOf, parseUnderstanding, UNDERSTAND_SCHEMA, type UnderstandResult } from "./recipe";

/**
 * Reads a meal from free text with Google Gemini (free tier of Google AI Studio). Gemini only
 * understands the words (structured output): the dish, its ingredients and amounts, the units
 * a recipe made and how many were eaten. The nutrition is counted in code (recipe.ts).
 * Only the meal text is sent: no name, email, profile or health data.
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

const SYSTEM = `אתה מבין תיאורי אוכל חופשיים בעברית. אתה לא מחשב ערכים תזונתיים של הארוחה: את החישוב עושה קוד.
החזר רק מה שהבנת:
- dish: שם המאכל או הארוחה בקצרה.
- kind: "single" לארוחה רגילה או פריטים בודדים, "recipe" למתכון שהוכן ואז חולק ליחידות (כדורים, פרוסות, עוגיות), "pot_portion" לחלק מסיר או תבנית.
- ingredients: כל מרכיב או פריט, עם שם קצר בעברית כפי שנקרא בדרך כלל (למשל "שוקולד מריר", "חמאת בוטנים", "קורנפלקס"), כמות ויחידה אם נאמרו.
  יחידות מותרות: g, kg, ml, l, pc, slice, tbsp, tsp, cup, bowl, plate, serving, handful, package.
  "חבילה", "חפיסה", "צנצנת שלמה", "קופסה שלמה" = package עם qty של מספר האריזות. אם המשקל של האריזה נאמר, החזר אותו בגרמים במקום package.
  approx=true כשהמשתמש אמר "בערך", "כמעט", "בסביבות".
  אם הכמות לא נאמרה, qty ו-unit הם null. אל תמציא כמויות.
  לכל מרכיב תן גם הערכה ל-100 גרם (kcal_100, protein_100, carbs_100, fat_100). הערכה זו משמשת רק כשאין מקור טוב יותר.
- yield_min/yield_max: לכמה יחידות יצא המתכון (למשל 40), ו-unit_name לשם היחידה ("כדורים"). null אם לא נאמר.
- eaten_min/eaten_max: כמה יחידות נאכלו (למשל 6 ו-7 עבור "6-7"). ב-pot_portion: החלק מהסיר כשבר (רבע = 0.25). null אם לא נאמר.
אם הטקסט אינו אוכל או שתייה, החזר not_food=true ורשימה ריקה. אל תיתן ייעוץ רפואי ואל תשפוט.`;

export type UnderstandMealResult = UnderstandResult | { ok: false; reason: "no_key" | "bad_key" | "busy" | "limit" };

/** Sends only the meal text to Gemini and reads back what it understood (no totals). */
export async function understandMeal(text: string): Promise<UnderstandMealResult> {
  // Pasted keys often carry a space, a newline or quotes.
  const key = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) return { ok: false, reason: "no_key" };
  let last: UnderstandMealResult = { ok: false, reason: "failed" };
  for (const model of MODELS) {
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: text.slice(0, 1000) }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: UNDERSTAND_SCHEMA, ...thinkingFor(model) },
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
        console.error("understandMeal failed", model, res.status, detail);
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
      const result = parseUnderstanding(raw);
      if (result.ok || result.reason === "not_food") return result;
      console.error("understandMeal unreadable reply", model, raw.slice(0, 300));
      last = result;
    } catch (e) {
      // Timeout or network error: trying more models would only make the user wait longer.
      console.error("understandMeal error", model, e instanceof Error ? e.message : e);
      return { ok: false, reason: "busy" };
    }
  }
  return last;
}

/**
 * Items for free text: the AI understands it, the code counts it (recipe.ts), with the usual
 * portions and package sizes where an amount is missing. The ranges and the confidence say how
 * sure the count is.
 */
export async function estimateMeal(text: string): Promise<EstimateResult> {
  const u = await understandMeal(text);
  if (!u.ok) return u.reason === "limit" ? { ok: false, reason: "limit" } : { ok: false, reason: u.reason };
  const m = computeMeal(u.understanding);
  const items = itemsOf(m).flatMap((i) => {
    const p = foodItemSchema.safeParse(i);
    return p.success ? [p.data] : [];
  });
  if (!items.length) return { ok: false, reason: "failed" };
  return { ok: true, items, question: m.questions[0]?.text ?? null };
}
