import { createHash, randomInt } from "node:crypto";

/** No look-alike characters (0/O, 1/I/L). */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;

export function newInviteCode(): string {
  return Array.from({ length: LENGTH }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join("");
}

/** Normalises what a person typed: spaces, dashes and case do not matter. */
export function normaliseCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, "");
  return new RegExp(`^[${INVITE_ALPHABET}]{${LENGTH}}$`).test(c) ? c : null;
}

/** Only this hash is stored. */
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
