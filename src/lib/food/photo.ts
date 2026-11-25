import "server-only";
import { classifyGeminiError, MODELS, thinkingFor } from "./estimate";

/**
 * A photo of a meal → a short Hebrew description with amounts ("2 ביצים, פרוסת לחם מלא, סלט
 * ירקות"), which then goes through the same counting as typed text (analyze.ts). Gemini only
 * says what it sees; it gives no numbers. Only the image is sent, nothing about the user.
 */
export type PhotoResult = { ok: true; text: string } | { ok: false; reason: "no_key" | "bad_key" | "busy" | "not_food" | "failed" };

const SYSTEM = `אתה מסתכל על תמונה של אוכל ומתאר בעברית פשוטה מה יש בה, כמו שאדם היה כותב ביומן אוכל.
כתוב שורה אחת: כל מאכל עם כמות משוערת במילים פשוטות (יחידות, פרוסות, כפות, כוסות, צלחת, או גרמים), מופרדים בפסיקים.
לדוגמה: "2 ביצים מקושקשות, 2 פרוסות לחם מלא, סלט ירקות קטן, כף טחינה".
אל תכתוב קלוריות או ערכים תזונתיים. אם אין בתמונה אוכל או שתייה, החזר not_food=true.`;

const SCHEMA = {
  type: "OBJECT",
  properties: { text: { type: "STRING" }, not_food: { type: "BOOLEAN" } },
  required: ["text", "not_food"],
};

export async function describePhoto(base64: string, mime: string): Promise<PhotoResult> {
  const key = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) return { ok: false, reason: "no_key" };
  let last: PhotoResult = { ok: false, reason: "failed" };
  for (const model of MODELS) {
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: base64 } }, { text: "מה אכלתי?" }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA, ...thinkingFor(model) },
    });
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 500);
        const kind = classifyGeminiError(res.status, detail);
        console.error("describePhoto failed", model, res.status, detail);
        if (kind === "bad_key") return { ok: false, reason: "bad_key" };
        if (kind === "failed") return { ok: false, reason: "failed" };
        if (kind === "busy") last = { ok: false, reason: "busy" };
        continue;
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const raw = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
      const parsed = readReply(raw);
      if (parsed) return parsed;
      last = { ok: false, reason: "failed" };
    } catch (e) {
      console.error("describePhoto error", model, e instanceof Error ? e.message : e);
      return { ok: false, reason: "busy" };
    }
  }
  return last;
}

/** Exported for tests. */
export function readReply(raw: string): PhotoResult | null {
  try {
    const j = JSON.parse(raw) as { text?: unknown; not_food?: unknown };
    if (j.not_food === true) return { ok: false, reason: "not_food" };
    const text = typeof j.text === "string" ? j.text.replace(/\s+/g, " ").trim().slice(0, 400) : "";
    return text.length >= 2 ? { ok: true, text } : null;
  } catch {
    return null;
  }
}
