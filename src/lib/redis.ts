import { Redis } from 'ioredis';

const globalForRedis = globalThis as unknown as {
    redis: Redis | undefined;
};

// Check if REDIS_URL is configured, otherwise fallback to local dev
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis =
    globalForRedis.redis ??
    new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

// Persist the instance on hot-reloading in dev.
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
