import "server-only";
import { createHash } from "node:crypto";

/** Minimal Telegram Bot API client. The token stays on the server (TELEGRAM_BOT_TOKEN). */

export type InlineButton = { text: string; callback_data: string };

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export async function tg(method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const token = botToken();
  if (!token) return { ok: false, description: "no token" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
    if (!data.ok) console.error("telegram", method, data.description);
    return data;
  } catch (e) {
    console.error("telegram", method, e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

export function send(chatId: number, text: string, buttons?: InlineButton[][]) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

/** The webhook secret is derived from the token, so there is one less setting to manage. */
export function webhookSecret(): string | null {
  const token = botToken();
  if (!token) return null;
  return createHash("sha256").update(`trAIning-webhook:${token}`).digest("hex");
}
