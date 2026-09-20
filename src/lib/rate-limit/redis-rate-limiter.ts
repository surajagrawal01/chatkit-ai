import { getRedisClient } from "../redis/redisClient";
import { RateLimitResult } from "./types";

export class RedisRateLimiter {
    constructor(
        private maxRequests: number,
        private windowSeconds: number
    ) { }

    async limit(identifier: string): Promise<RateLimitResult> {
        const redis = await getRedisClient()

        const key = `rate-limit:${identifier}`;

        //atomic increment -> so for multiple requests good thing
        const count = await redis.incr(key);

        //to expire the key-value after the given time period
        if (count === 1) {
            await redis.expire(
                key,
                this.windowSeconds
            );
        }

        const ttl = await redis.ttl(key)

        const allowed = count <= this.maxRequests;

        return {
            allowed,
            remaining: Math.max(0,
                this.maxRequests - count
            ),
            resetAt: Date.now() + ttl * 1000
        }

    }
}