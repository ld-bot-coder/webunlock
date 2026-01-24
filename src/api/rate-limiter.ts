/**
 * Rate Limiter
 * In-memory rate limiting (ready for Redis upgrade)
 */

import { config as appConfig } from '../config/index.js';

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

/**
 * In-memory rate limiter
 */
export class RateLimiter {
    private readonly store: Map<string, RateLimitEntry> = new Map();
    private readonly windowMs: number;
    private readonly maxRequests: number;
    private readonly enabled: boolean;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(options?: {
        windowMs?: number;
        maxRequests?: number;
        enabled?: boolean;
    }) {
        this.windowMs = options?.windowMs ?? appConfig.rateLimit.windowMs;
        this.maxRequests = options?.maxRequests ?? appConfig.rateLimit.maxRequests;
        this.enabled = options?.enabled ?? appConfig.rateLimit.enabled;

        // Cleanup old entries periodically
        if (this.enabled) {
            this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
        }
    }

    /**
     * Check if a request is allowed
     */
    isAllowed(key: string): { allowed: boolean; remaining: number; resetAt: number } {
        if (!this.enabled) {
            return { allowed: true, remaining: this.maxRequests, resetAt: 0 };
        }

        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now - entry.windowStart >= this.windowMs) {
            // New window
            this.store.set(key, { count: 1, windowStart: now });
            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetAt: now + this.windowMs,
            };
        }

        if (entry.count >= this.maxRequests) {
            // Rate limited
            return {
                allowed: false,
                remaining: 0,
                resetAt: entry.windowStart + this.windowMs,
            };
        }

        // Increment count
        entry.count++;
        return {
            allowed: true,
            remaining: this.maxRequests - entry.count,
            resetAt: entry.windowStart + this.windowMs,
        };
    }

    /**
     * Consume a rate limit token (for post-request accounting)
     */
    consume(key: string): void {
        if (!this.enabled) return;

        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now - entry.windowStart >= this.windowMs) {
            this.store.set(key, { count: 1, windowStart: now });
        } else {
            entry.count++;
        }
    }

    /**
     * Get remaining requests for a key
     */
    getRemaining(key: string): number {
        if (!this.enabled) return this.maxRequests;

        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now - entry.windowStart >= this.windowMs) {
            return this.maxRequests;
        }

        return Math.max(0, this.maxRequests - entry.count);
    }

    /**
     * Reset rate limit for a key
     */
    reset(key: string): void {
        this.store.delete(key);
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now - entry.windowStart >= this.windowMs) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Get current stats
     */
    getStats(): { activeKeys: number; windowMs: number; maxRequests: number } {
        return {
            activeKeys: this.store.size,
            windowMs: this.windowMs,
            maxRequests: this.maxRequests,
        };
    }

    /**
     * Shutdown cleanup
     */
    shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.store.clear();
    }
}

// Singleton instance
let rateLimiter: RateLimiter | null = null;

/**
 * Get the global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
    if (!rateLimiter) {
        rateLimiter = new RateLimiter();
    }
    return rateLimiter;
}

/**
 * Create rate limit middleware data
 */
export function createRateLimitHeaders(
    remaining: number,
    resetAt: number
): Record<string, string> {
    return {
        'X-RateLimit-Limit': String(appConfig.rateLimit.maxRequests),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    };
}
