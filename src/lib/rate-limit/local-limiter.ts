import { RateLimitEntry } from "./types";


export class LocalRateLimiter {
    private hits = new Map<string, RateLimitEntry>()

    constructor(
        private maxRequests: number,
        private windowsMs: number
    ) { }


    private cleanupExpired() {
        const now = Date.now();

        for (const [key, entry] of this.hits) {
            if (now >= entry.resetAt) {
                this.hits.delete(key);
            }
        }
    }

    limit(identifier: string) {
        const now = Date.now()

        const entry = this.hits.get(identifier);

        console.log(this.hits, "map hits")

        // First request OR previous window expired
        if (!entry || now >= entry.resetAt) {
            this.hits.set(identifier, {
                count: 1,
                resetAt: now + this.windowsMs
            })

            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetAt: now + this.windowsMs
            }
        }


        //Limit Exceeded
        if (entry.count >= this.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: entry.resetAt
            }
        }

        //Normal Request
        entry.count++;

        return {
            allowed: true,
            remaining: this.maxRequests - entry.count,
            resetAt: entry.resetAt
        }
    }
}