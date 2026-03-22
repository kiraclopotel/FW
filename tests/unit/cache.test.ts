import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processingCache } from '../../src/storage/cache';
import { AnalysisResult } from '../../src/types/analysis';

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    postId: 'test-post',
    techniques: [],
    overallScore: 7,
    overallConfidence: 0.85,
    isManipulative: true,
    processingTimeMs: 100,
    ...overrides,
  };
}

describe('ProcessingCache', () => {
  beforeEach(() => {
    processingCache.clear();
    vi.restoreAllMocks();
  });

  it('returns null for unknown hash', () => {
    expect(processingCache.get('unknown-hash')).toBeNull();
  });

  it('returns cached entry for known hash', () => {
    const analysis = makeAnalysis();
    processingCache.set('hash-1', analysis, 'neutralized text');

    const entry = processingCache.get('hash-1');
    expect(entry).not.toBeNull();
    expect(entry!.analysis).toEqual(analysis);
    expect(entry!.neutralizedText).toBe('neutralized text');
  });

  it('evicts expired entries', () => {
    const analysis = makeAnalysis();
    processingCache.set('hash-old', analysis, 'text');

    // Advance time past 30 minutes
    const realNow = Date.now;
    Date.now = () => realNow() + 31 * 60 * 1000;

    expect(processingCache.get('hash-old')).toBeNull();
    expect(processingCache.size).toBe(0);

    Date.now = realNow;
  });

  it('evicts oldest entry when at capacity', () => {
    const analysis = makeAnalysis();

    // Fill to capacity (500)
    for (let i = 0; i < 500; i++) {
      processingCache.set(`hash-${i}`, analysis, null);
    }
    expect(processingCache.size).toBe(500);

    // Adding one more should evict the first
    processingCache.set('hash-new', analysis, null);
    expect(processingCache.size).toBe(500);
    expect(processingCache.get('hash-0')).toBeNull();
    expect(processingCache.get('hash-new')).not.toBeNull();
  });

  it('LRU: recently accessed entry survives eviction', () => {
    const analysis = makeAnalysis();

    // Fill to capacity
    for (let i = 0; i < 500; i++) {
      processingCache.set(`hash-${i}`, analysis, null);
    }

    // Touch hash-1 (moves it to end)
    processingCache.get('hash-1');

    // Add new entry — should evict hash-2 (now the oldest), not hash-1
    processingCache.set('hash-new', analysis, null);
    expect(processingCache.get('hash-1')).not.toBeNull();
  });

  it('clear() empties cache', () => {
    const analysis = makeAnalysis();
    processingCache.set('hash-a', analysis, null);
    processingCache.set('hash-b', analysis, 'text');
    expect(processingCache.size).toBe(2);

    processingCache.clear();
    expect(processingCache.size).toBe(0);
    expect(processingCache.get('hash-a')).toBeNull();
  });

  it('has() returns correct boolean without touching LRU', () => {
    const analysis = makeAnalysis();
    processingCache.set('hash-x', analysis, null);

    expect(processingCache.has('hash-x')).toBe(true);
    expect(processingCache.has('nonexistent')).toBe(false);
  });

  it('has() returns false for expired entries', () => {
    const analysis = makeAnalysis();
    processingCache.set('hash-exp', analysis, null);

    const realNow = Date.now;
    Date.now = () => realNow() + 31 * 60 * 1000;

    expect(processingCache.has('hash-exp')).toBe(false);

    Date.now = realNow;
  });
});
