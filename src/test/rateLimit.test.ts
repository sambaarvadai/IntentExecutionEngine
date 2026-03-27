// Fixed version of rateLimit.test.ts - separate limiter instances and syntax fixes

import { RateLimiter } from '../api/rateLimit'

describe('RateLimiter', () => {
  let limiter: RateLimiter
  let mockTime: number

  beforeEach(() => {
    limiter = new RateLimiter({
      requestsPerMinute: 3,
      requestsPerHour: 1000,
      burstLimit: 1000
    })
    mockTime = Date.now()
  })

  describe('basic rate limiting', () => {
    it('allows first request', () => {
      const result = limiter.check('user1')
      expect(result.allowed).toBe(true)
    })

    it('allows second request', () => {
      limiter.check('user1')
      const result = limiter.check('user1')
      expect(result.allowed).toBe(true)
    })

    it('allows third request', () => {
      limiter.check('user1')
      limiter.check('user1')
      const result = limiter.check('user1')
      expect(result.allowed).toBe(true)
    })

    it('blocks fourth request with rate_limit_per_minute', () => {
      limiter.check('user1')
      limiter.check('user1')
      limiter.check('user1')
      const result = limiter.check('user1')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('rate_limit_per_minute')
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })
  })

  describe('hourly limiting', () => {
    let limiter: RateLimiter

    beforeEach(() => {
      limiter = new RateLimiter({
        requestsPerMinute: 1000,
        requestsPerHour: 3,
        burstLimit: 1000
      })
    })

    it('allows requests within hourly limit', () => {
      for (let i = 0; i < 2; i++) {
        const result = limiter.check(`allow-user`)
        expect(result.allowed).toBe(true)
      }
    })

    it('blocks requests exceeding hourly limit', () => {
      for (let i = 0; i < 3; i++) {
        limiter.check('same-user')  // same key every time
      }
      const result = limiter.check('same-user')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('rate_limit_per_hour')
    })
  })

  describe('burst limiting', () => {
    let limiter: RateLimiter

    beforeEach(() => {
      limiter = new RateLimiter({
        requestsPerMinute: 1000,
        requestsPerHour: 1000,
        burstLimit: 2
      })
    })

    it('allows requests within burst limit', () => {
      const result1 = limiter.check('user2')
      const result2 = limiter.check('user2')
      
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
    })

    it('blocks requests exceeding burst limit', () => {
      limiter.check('user2')
      limiter.check('user2')
      const result = limiter.check('user2')
      
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('rate_limit_burst')
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })
  })

  describe('different keys', () => {
    let limiter: RateLimiter

    beforeEach(() => {
      limiter = new RateLimiter({
        requestsPerMinute: 3,
        requestsPerHour: 1000,
        burstLimit: 1000
      })
    })

    it('handles different keys independently', () => {
      const result1 = limiter.check('userA')
      const result2 = limiter.check('userB')
      const result3 = limiter.check('userA')
      
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
      expect(result3.allowed).toBe(true) // userA has 2 requests, still under limit
    })
  })

  describe('statistics', () => {
    it('provides stats for a key', () => {
      limiter.check('userStats')
      limiter.check('userStats')
      
      const stats = limiter.getStats('userStats')
      
      expect(stats.totalRequests).toBe(2)
      expect(stats.lastCalledAt).toBeInstanceOf(Date)
    })
  })
})
