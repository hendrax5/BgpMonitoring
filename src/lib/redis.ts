import { Redis } from 'ioredis';

const globalForRedis = globalThis as unknown as {
    redis: Redis | undefined;
};

// Check if REDIS_URL is configured, otherwise fallback to local dev
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisClient(): Redis {
    const client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,          // Don't connect immediately on startup
        retryStrategy: (times) => {
            // Retry with exponential backoff up to 10 seconds
            if (times > 5) return null; // Give up after 5 retries
            return Math.min(times * 500, 10000);
        },
    });

    // IMPORTANT: Catch connection errors so the app doesn't crash
    client.on('error', (err) => {
        console.error('[Redis] Connection error (app will continue without cache):', err.message);
    });

    client.on('connect', () => {
        console.log('[Redis] Connected successfully');
    });

    return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

// Persist the instance on hot-reloading in dev.
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
