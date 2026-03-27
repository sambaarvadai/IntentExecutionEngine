"use strict";
// src/api/rateLimit.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.RateLimiter = void 0;
class RateLimiter {
    constructor(defaultConfig) {
        this.requests = new Map();
        this.config = {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
            burstLimit: 10,
            ...defaultConfig
        };
        // Clean up expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    /**
     * Check if a request should be allowed
     */
    check(key, config) {
        const effectiveConfig = { ...this.config, ...config };
        const now = Date.now();
        const requests = this.requests.get(key);
        if (!requests) {
            this.requests.set(key, [now]);
            return { allowed: true };
        }
        // Remove expired entries (older than 1 hour)
        const validRequests = requests.filter(timestamp => now - timestamp < 60 * 60 * 1000);
        // Check all three limits
        const minuteAgo = now - 60 * 1000;
        const hourAgo = now - 60 * 60 * 1000;
        const secondAgo = now - 1000;
        const recentMinute = validRequests.filter(timestamp => timestamp > minuteAgo).length;
        const recentHour = validRequests.filter(timestamp => timestamp > hourAgo).length;
        const recentSecond = validRequests.filter(timestamp => timestamp > secondAgo).length;
        // Check per-minute limit
        if (recentMinute >= effectiveConfig.requestsPerMinute) {
            const oldestInWindow = validRequests.find(t => t > minuteAgo);
            return {
                allowed: false,
                reason: 'rate_limit_per_minute',
                retryAfterMs: oldestInWindow ? (60 * 1000 - (now - oldestInWindow)) : 60 * 1000
            };
        }
        // Check per-hour limit
        if (recentHour >= effectiveConfig.requestsPerHour) {
            const oldestInWindow = validRequests.find(t => t > hourAgo);
            return {
                allowed: false,
                reason: 'rate_limit_per_hour',
                retryAfterMs: oldestInWindow ? (60 * 60 * 1000 - (now - oldestInWindow)) : 60 * 60 * 1000
            };
        }
        // Check burst limit
        if (recentSecond >= effectiveConfig.burstLimit) {
            const oldestInWindow = validRequests.find(t => t > secondAgo);
            return {
                allowed: false,
                reason: 'rate_limit_burst',
                retryAfterMs: oldestInWindow ? (1000 - (now - oldestInWindow)) : 1000
            };
        }
        // Record this request
        validRequests.push(now);
        this.requests.set(key, validRequests);
        return { allowed: true };
    }
    /**
     * Reset all counters for a specific key
     */
    reset(key) {
        this.requests.delete(key);
    }
    /**
     * Clean up expired entries across all keys
     */
    cleanup() {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        for (const [key, requests] of this.requests.entries()) {
            const validRequests = requests.filter(timestamp => timestamp > oneHourAgo);
            if (validRequests.length === 0) {
                this.requests.delete(key);
            }
            else {
                this.requests.set(key, validRequests);
            }
        }
    }
    /**
     * Get current statistics for a key
     */
    getStats(key) {
        const requests = this.requests.get(key) || [];
        const now = Date.now();
        const validRequests = requests.filter(timestamp => now - timestamp < 60 * 60 * 1000);
        return {
            totalRequests: requests.length,
            successCount: validRequests.length, // Simplified - all recorded requests are "successes"
            errorCount: 0,
            blockedCount: 0,
            avgExecutionTimeMs: 0,
            lastCalledAt: requests.length > 0 ? new Date(requests[requests.length - 1]) : undefined
        };
    }
}
exports.RateLimiter = RateLimiter;
// Export singleton instance
exports.rateLimiter = new RateLimiter();
//# sourceMappingURL=rateLimit.js.map