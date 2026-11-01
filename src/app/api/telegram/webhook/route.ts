import { timingSafeEqual } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { webhookSecret } from "@/lib/telegram/api";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/handle";

/**
 * Telegram webhook. Telegram sends the secret set with setWebhook (derived from the bot token) in a header; anything
 * without it is refused. The update is acknowledged at once and handled right after, so a slow
 * AI estimate does not make Telegram retry. Retries are de-duplicated by update_id anyway.
 */
export async function POST(req: NextRequest) {
  const secret = webhookSecret();
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return new Response("forbidden", { status: 403 });
  }
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (typeof update?.update_id !== "number") return new Response("ok");
  after(() => handleUpdate(update).catch((e) => console.error("telegram update failed", e instanceof Error ? e.message : e)));
  return new Response("ok");
}
