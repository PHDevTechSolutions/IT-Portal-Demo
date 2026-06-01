/**
 * lib/auth/tempToken.ts
 *
 * Short-lived in-memory tokens issued after password verification,
 * before TOTP is confirmed. Expires in 5 minutes.
 *
 * In-memory is fine here — tokens are single-use and very short-lived.
 * For multi-instance deployments, swap the Map for Redis.
 */

interface TempEntry {
  userId:    string;
  email:     string;
  expiresAt: number;
}

const store = new Map<string, TempEntry>();

/** Issue a temp token valid for 5 minutes */
export function issueTempToken(userId: string, email: string): string {
  const token     = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
  store.set(token, { userId, email, expiresAt });
  return token;
}

/** Consume a temp token — returns the entry and deletes it (single-use) */
export function consumeTempToken(token: string): TempEntry | null {
  const entry = store.get(token);
  if (!entry) return null;
  store.delete(token); // single-use
  if (Date.now() > entry.expiresAt) return null; // expired
  return entry;
}

/** Cleanup expired tokens (call periodically if needed) */
export function pruneExpiredTokens() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}
