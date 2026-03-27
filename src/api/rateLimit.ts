// src/api/rateLimit.ts

/**
 * In-memory rate limiting implementation for API protection
 */

export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
  burstLimit: number        // max concurrent requests at once
}

export interface RateLimitResult {
  allowed: boolean
  reason?: string           // why it was blocked
  retryAfterMs?: number     // how long to wait
}

export class RateLimiter {
  private readonly config: RateLimitConfig
  private readonly requests: Map<string, number[]> = new Map()
  private readonly cleanupInterval: NodeJS.Timeout

  constructor(defaultConfig?: Partial<RateLimitConfig>) {
    this.config = {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10,
      ...defaultConfig
    }

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  /**
   * Check if a request should be allowed
   */
  check(key: string, config?: Partial<RateLimitConfig>): RateLimitResult {
    const effectiveConfig = { ...this.config, ...config }
    const now = Date.now()
    const requests = this.requests.get(key)

    if (!requests) {
      this.requests.set(key, [now])
      return { allowed: true }
    }

    // Remove expired entries (older than 1 hour)
    const validRequests = requests.filter(timestamp => now - timestamp < 60 * 60 * 1000)

    // Check all three limits
    const minuteAgo = now - 60 * 1000
    const hourAgo = now - 60 * 60 * 1000
    const secondAgo = now - 1000

    const recentMinute = validRequests.filter(timestamp => timestamp > minuteAgo).length
    const recentHour = validRequests.filter(timestamp => timestamp > hourAgo).length
    const recentSecond = validRequests.filter(timestamp => timestamp > secondAgo).length

    // Check per-minute limit
    if (recentMinute >= effectiveConfig.requestsPerMinute) {
      const oldestInWindow = validRequests.find(t => t > minuteAgo)
      return {
        allowed: false,
        reason: 'rate_limit_per_minute',
        retryAfterMs: oldestInWindow ? (60 * 1000 - (now - oldestInWindow)) : 60 * 1000
      }
    }

    // Check per-hour limit
    if (recentHour >= effectiveConfig.requestsPerHour) {
      const oldestInWindow = validRequests.find(t => t > hourAgo)
      return {
        allowed: false,
        reason: 'rate_limit_per_hour',
        retryAfterMs: oldestInWindow ? (60 * 60 * 1000 - (now - oldestInWindow)) : 60 * 60 * 1000
      }
    }

    // Check burst limit
    if (recentSecond >= effectiveConfig.burstLimit) {
      const oldestInWindow = validRequests.find(t => t > secondAgo)
      return {
        allowed: false,
        reason: 'rate_limit_burst',
        retryAfterMs: oldestInWindow ? (1000 - (now - oldestInWindow)) : 1000
      }
    }

    // Record this request
    validRequests.push(now)
    this.requests.set(key, validRequests)

    return { allowed: true }
  }

  /**
   * Reset all counters for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key)
  }

  /**
   * Clean up expired entries across all keys
   */
  private cleanup(): void {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > oneHourAgo)
      if (validRequests.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, validRequests)
      }
    }
  }

  /**
   * Get current statistics for a key
   */
  getStats(key: string): {
    totalRequests: number
    successCount: number
    errorCount: number
    blockedCount: number
    avgExecutionTimeMs: number
    lastCalledAt?: Date
  } {
    const requests = this.requests.get(key) || []
    const now = Date.now()
    const validRequests = requests.filter(timestamp => now - timestamp < 60 * 60 * 1000)

    return {
      totalRequests: requests.length,
      successCount: validRequests.length, // Simplified - all recorded requests are "successes"
      errorCount: 0,
      blockedCount: 0,
      avgExecutionTimeMs: 0,
      lastCalledAt: requests.length > 0 ? new Date(requests[requests.length - 1]) : undefined
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()
