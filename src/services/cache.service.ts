import { logger } from '../utils/logger';

type CacheEntry<T> = {
  data: T;
  expiresAt: number; // Unix timestamp in milliseconds
};

/**
 * Simple in-memory cache with TTL
 * No Redis needed for single instance deployment
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtlMs = 60 * 1000; // 60 seconds

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug({ key }, 'Cache entry expired');
      return null;
    }

    logger.debug({ key }, 'Cache hit');
    return entry.data as T;
  }

  /**
   * Set cached value with optional TTL
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);

    this.cache.set(key, {
      data,
      expiresAt,
    });

    logger.debug({ key, ttlMs: ttlMs ?? this.defaultTtlMs }, 'Cache set');
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    logger.debug({ key }, 'Cache invalidated');
  }

  /**
   * Invalidate all keys matching pattern
   */
  invalidatePattern(pattern: string): void {
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    logger.debug({ pattern, deletedCount }, 'Cache pattern invalidated');
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ clearedEntries: size }, 'Cache cleared');
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries (called periodically)
   */
  cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.debug({ deletedCount }, 'Cache cleanup completed');
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();
