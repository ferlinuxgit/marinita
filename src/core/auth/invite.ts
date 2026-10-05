import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time comparison so the invite code cannot be guessed by measuring response times. */
export function inviteCodeMatches(provided: unknown, expected: string | undefined) {
  if (!expected || typeof provided !== "string") {
    return false;
  }

  return timingSafeEqual(digest(provided), digest(expected));
}
