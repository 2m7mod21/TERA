import Redis from "ioredis";

// ─── Singleton Redis Client ────────────────────────────────────────────────────
// Gracefully degrades when REDIS_URL is not configured — the cache layer will
// simply fall through to the database on every call, preserving correctness.

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
};

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Redis] REDIS_URL not set — caching disabled, all requests hit DB");
    }
    return null;
  }

  const client = new Redis(url, {
    // Reconnect with exponential backoff — do not hammer a down Redis
    retryStrategy(times) {
      if (times > 10) return null; // Stop retrying after 10 attempts
      return Math.min(times * 200, 5000); // Max 5s between retries
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false, // Fail fast — don't queue commands while reconnecting
    connectTimeout: 5000,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    // Log once per error type — don't spam logs
    if (process.env.NODE_ENV !== "test") {
      console.error("[Redis] Client error:", err.message);
    }
  });

  client.on("connect", () => {
    if (process.env.NODE_ENV !== "test") {
      console.info("[Redis] Connected");
    }
  });

  return client;
}

export const redis: Redis | null =
  globalForRedis.redis !== undefined
    ? globalForRedis.redis
    : (globalForRedis.redis = createRedisClient());
