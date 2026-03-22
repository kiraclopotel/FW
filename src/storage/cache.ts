// FeelingWise - Processing cache
// LRU cache keyed by SHA-256 of post text.
// Prevents re-processing identical content (retweets, reposts, scroll-back).
// Saves ~30-40% of API costs on feeds with repeated content.

import { AnalysisResult } from '../types/analysis';

interface CacheEntry {
  analysis: AnalysisResult;
  neutralizedText: string | null;
  timestamp: number;
}

const MAX_ENTRIES = 500;
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

class ProcessingCache {
  private cache = new Map<string, CacheEntry>();

  /**
   * Get a cached result by text hash.
   * Returns null if not found or expired.
   */
  get(textHash: string): CacheEntry | null {
    const entry = this.cache.get(textHash);
    if (!entry) return null;

    // Check expiry
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      this.cache.delete(textHash);
      return null;
    }

    // Move to end (LRU touch)
    this.cache.delete(textHash);
    this.cache.set(textHash, entry);

    return entry;
  }

  /**
   * Store a processing result.
   */
  set(textHash: string, analysis: AnalysisResult, neutralizedText: string | null): void {
    // Evict oldest if at capacity
    if (this.cache.size >= MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(textHash, {
      analysis,
      neutralizedText,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a hash exists (without touching LRU order).
   */
  has(textHash: string): boolean {
    const entry = this.cache.get(textHash);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      this.cache.delete(textHash);
      return false;
    }

    return true;
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const processingCache = new ProcessingCache();
