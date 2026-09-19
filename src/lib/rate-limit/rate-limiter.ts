import { LocalRateLimiter } from "./local-limiter"


function createRateLimiter() {
    const storage = process.env.RATE_LIMIT_STORAGE ?? "local"

    if (storage === "redis") {
        //Redis not implemented yet
        throw new Error("Redis is not implemented ye")
    }

    return new LocalRateLimiter(
        5,
        60 * 5 * 1000
    );
}

export const rateLimiter = createRateLimiter();