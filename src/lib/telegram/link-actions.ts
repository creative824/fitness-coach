"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requestOrigin } from "@/lib/auth/origin";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { botToken, tg, webhookSecret } from "./api";
import { hashCode } from "./handle";
import { CODE_ALPHABET } from "./intent";

const CODE_MINUTES = 10;

/** Points Telegram at this site's webhook, once. Called when someone starts linking. */
async function ensureWebhook(): Promise<{ ok: boolean; username: string | null }> {
  const [me, info] = await Promise.all([tg("getMe", {}), tg("getWebhookInfo", {})]);
  const username = (me.result as { username?: string } | undefined)?.username ?? null;
  const url = `${await requestOrigin()}/api/telegram/webhook`;
  if ((info.result as { url?: string } | undefined)?.url === url) return { ok: me.ok, username };
  if (url.startsWith("http://")) return { ok: false, username }; // Telegram needs https (local dev)
  const set = await tg("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await tg("setMyCommands", {
    commands: [
      { command: "today", description: "מה נשאר לי היום" },
      { command: "calories", description: "הערכת קלוריות להיום" },
      { command: "help", description: "מה אפשר לכתוב" },
      { command: "unlink", description: "ניתוק מהחשבון" },
    ],
  });
  return { ok: set.ok, username };
}

export type LinkCode =
  | { ok: true; code: string; url: string | null; expiresAt: string }
  | { ok: false; reason: "not_configured" | "failed" };

/** A one-time code that links a Telegram chat to this account. Only its hash is stored. */
export async function createTelegramCode(): Promise<LinkCode> {
  const user = await requireUser();
  if (!botToken() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: "not_configured" };
  const hook = await ensureWebhook();
  const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000).toISOString();
  const supabase = await createClient();
  await supabase.from("telegram_link_tokens").delete().eq("user_id", user.id).is("used_at", null);
  const { error } = await supabase.from("telegram_link_tokens").insert({ user_id: user.id, token_hash: hashCode(code), expires_at: expiresAt });
  if (error) {
    console.error("createTelegramCode", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, code, url: hook.username ? `https://t.me/${hook.username}?start=${code}` : null, expiresAt };
}

export async function unlinkTelegram(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("telegram_links").delete().eq("user_id", user.id);
  revalidatePath("/profile");
  return { ok: !error };
}
