import { redis } from "@/lib/redis";

// ─── Generic Cache Helpers ─────────────────────────────────────────────────────

/**
 * Fetch from Redis cache, or compute the value and store it.
 * Gracefully falls through to `fn()` if Redis is unavailable.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!redis) return fn();

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis read failure — fall through to DB
  }

  const value = await fn();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Redis write failure — return value, do not block the request
  }

  return value;
}

/**
 * Delete a single cache key.
 */
export async function invalidate(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Ignore
  }
}

/**
 * Delete all keys matching a glob pattern (e.g. "feed:user123:*").
 * Uses SCAN under the hood so it's safe in production (no KEYS command).
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // Ignore
  }
}

// ─── Cache Key Builders ────────────────────────────────────────────────────────

export const CacheKeys = {
  feed: (userId: string, type: string, cursor: string | null) =>
    `feed:${userId}:${type}:${cursor ?? "start"}`,
  feedPage: (userId: string) => `feed:${userId}:*`,

  trending: () => "trending:topics",
  suggestedUsers: (userId: string) => `suggested:${userId}`,
  activeFriends: (userId: string) => `active:${userId}`,

  profile: (username: string) => `profile:${username}`,
  notifCount: (userId: string) => `notif:count:${userId}`,

  postReactions: (postId: string) => `post:reactions:${postId}`,
} as const;
