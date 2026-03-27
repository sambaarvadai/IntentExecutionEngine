/**
 * In-memory rate limiting implementation for API protection
 */
export interface RateLimitConfig {
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit: number;
}
export interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    retryAfterMs?: number;
}
export declare class RateLimiter {
    private readonly config;
    private readonly requests;
    private readonly cleanupInterval;
    constructor(defaultConfig?: Partial<RateLimitConfig>);
    /**
     * Check if a request should be allowed
     */
    check(key: string, config?: Partial<RateLimitConfig>): RateLimitResult;
    /**
     * Reset all counters for a specific key
     */
    reset(key: string): void;
    /**
     * Clean up expired entries across all keys
     */
    private cleanup;
    /**
     * Get current statistics for a key
     */
    getStats(key: string): {
        totalRequests: number;
        successCount: number;
        errorCount: number;
        blockedCount: number;
        avgExecutionTimeMs: number;
        lastCalledAt?: Date;
    };
}
export declare const rateLimiter: RateLimiter;
//# sourceMappingURL=rateLimit.d.ts.map