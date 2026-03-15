import { Redis } from 'ioredis';

const globalForRedis = globalThis as unknown as {
    redis: Redis | undefined;
};

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisClient(): Redis {
    const client = new Redis(REDIS_URL, {
        // CRITICAL: null means retry forever → app hangs. Use 3 retries max.
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        // lazyConnect: don't block on startup, connect on first command
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 5000,
        retryStrategy: (times) => {
            if (times > 5) return null; // stop retrying after 5 attempts
            return Math.min(times * 500, 3000);
        },
    });

    client.on('error', (err) => {
        console.error('[Redis] Connection error (app will continue without cache):', err.message);
    });

    client.on('connect', () => {
        console.log('[Redis] Connected successfully');
    });

    return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

