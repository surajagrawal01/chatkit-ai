import { createClient } from "redis";

const redis = createClient({
    url: process.env.REDIS_URL,
});

redis.on("error", (error) => {
    console.error("Redis error:", error);
});

export async function getRedisClient() {
    if (!redis.isOpen) {
        await redis.connect();
    }

    return redis;
}