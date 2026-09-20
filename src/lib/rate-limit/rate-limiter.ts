import { LocalRateLimiter } from "./local-limiter"
import { RedisRateLimiter } from "./redis-rate-limiter";


function createRateLimiter() {
    const storage = process.env.RATE_LIMIT_STORAGE ?? "local"

    if (storage === "redis") {
        return new RedisRateLimiter(
            5,
            60 * 5
        )
    }

    return new LocalRateLimiter(
        5,
        60 * 5 * 1000
    );
}

export const rateLimiter = createRateLimiter();