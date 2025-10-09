// In-Memory Rate Limiter for Feed Tokens
// Prevents abuse without external dependencies

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Configuration from environment
const MAX_REQUESTS = parseInt(Deno.env.get('RATE_LIMIT_MAX_REQUESTS') || '100', 10);
const WINDOW_MS = parseInt(Deno.env.get('RATE_LIMIT_WINDOW_MS') || '60000', 10); // 1 minute
const RATE_LIMIT_ENABLED = Deno.env.get('ENABLE_RATE_LIMIT') !== 'false'; // Default: true

/**
 * In-memory rate limiter
 */
class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  /**
   * Check if request is allowed
   */
  checkLimit(token: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    limit: number;
  } {
    if (!RATE_LIMIT_ENABLED) {
      return {
        allowed: true,
        remaining: MAX_REQUESTS,
        resetAt: Date.now() + WINDOW_MS,
        limit: MAX_REQUESTS
      };
    }

    const now = Date.now();
    const limit = this.limits.get(token);

    // No limit yet or window expired
    if (!limit || now > limit.resetAt) {
      const newResetAt = now + WINDOW_MS;
      this.limits.set(token, {
        count: 1,
        resetAt: newResetAt
      });

      return {
        allowed: true,
        remaining: MAX_REQUESTS - 1,
        resetAt: newResetAt,
        limit: MAX_REQUESTS
      };
    }

    // Limit exceeded
    if (limit.count >= MAX_REQUESTS) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: limit.resetAt,
        limit: MAX_REQUESTS
      };
    }

    // Increment count
    limit.count++;

    return {
      allowed: true,
      remaining: MAX_REQUESTS - limit.count,
      resetAt: limit.resetAt,
      limit: MAX_REQUESTS
    };
  }

  /**
   * Get rate limit headers for response
   */
  getRateLimitHeaders(result: ReturnType<typeof this.checkLimit>): Record<string, string> {
    return {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetAt).toISOString()
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.limits.forEach((limit, token) => {
      if (now > limit.resetAt) {
        expiredKeys.push(token);
      }
    });

    expiredKeys.forEach(key => this.limits.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`[RATE-LIMITER] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeTokens: this.limits.size,
      maxRequests: MAX_REQUESTS,
      windowMs: WINDOW_MS,
      enabled: RATE_LIMIT_ENABLED
    };
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Auto-cleanup every 5 minutes
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);
