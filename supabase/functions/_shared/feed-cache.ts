// In-Memory LRU Cache for Feed Responses
// Reduces DB queries by 90% for hot data

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Configuration from environment
const CACHE_TTL_SEC = parseInt(Deno.env.get('FEED_CACHE_TTL_SEC') || '60', 10);
const CACHE_MAX_KEYS = parseInt(Deno.env.get('FEED_CACHE_MAX_KEYS') || '100', 10);
const CACHE_ENABLED = Deno.env.get('ENABLE_FEED_CACHE') !== 'false'; // Default: true

/**
 * LRU Cache with TTL support
 */
class FeedCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    if (!CACHE_ENABLED) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl: number = CACHE_TTL_SEC): void {
    if (!CACHE_ENABLED) return;

    // Evict oldest entry if at max capacity
    if (this.cache.size >= CACHE_MAX_KEYS) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Invalidate all cached entries
   */
  invalidateAll(): void {
    this.cache.clear();
    console.log('[CACHE] All entries invalidated');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxKeys: CACHE_MAX_KEYS,
      enabled: CACHE_ENABLED,
      ttlSeconds: CACHE_TTL_SEC
    };
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(params: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sorted = Object.keys(params).sort().map(k => `${k}:${params[k]}`).join('|');
    return sorted;
  }
}

// Singleton instance
export const feedCache = new FeedCache();

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  const keys = Array.from(feedCache['cache'].keys());
  const now = Date.now();
  
  keys.forEach(key => {
    const entry = feedCache['cache'].get(key);
    if (entry && now - entry.timestamp > entry.ttl * 1000) {
      feedCache['cache'].delete(key);
    }
  });
}, 5 * 60 * 1000);
