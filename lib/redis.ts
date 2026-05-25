import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export const RESERVATION_LOCK_TTL = 10; // seconds
export const IDEMPOTENCY_TTL = 86400; // 24 hours in seconds

export function stockLockKey(stockId: string) {
  return `lock:stock:${stockId}`;
}

export function idempotencyKey(key: string) {
  return `idempotency:${key}`;
}
