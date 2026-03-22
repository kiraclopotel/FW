import { describe, it, expect } from 'vitest';
import { textFingerprint, similarity, detectCampaigns } from '../../src/forensics/campaign-detector';
import { ForensicRecord } from '../../src/types/forensic';

function makeRecord(overrides: Partial<ForensicRecord> = {}): ForensicRecord {
  return {
    id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    platform: 'twitter',
    originalText: 'Some default text that is long enough for testing purposes here',
    originalHash: 'abc123',
    originalLength: 60,
    neutralizedText: 'Rewritten version of the text',
    author: '@testuser',
    postUrl: '',
    techniques: [{ name: 'fear-appeal', severity: 7, confidence: 0.9 }],
    overallScore: 7,
    userAgeCategory: 'teen',
    aiSource: 'cloud',
    feedSource: 'for-you',
    integrityHash: 'hash123',
    ...overrides,
  };
}

describe('textFingerprint', () => {
  it('generates character trigrams from cleaned text', () => {
    const fp = textFingerprint('hello world');
    expect(fp.size).toBeGreaterThan(0);
    expect(fp.has('hel')).toBe(true);
    expect(fp.has('ell')).toBe(true);
    expect(fp.has('wor')).toBe(true);
  });

  it('strips URLs, mentions, and hashtags', () => {
    const fp = textFingerprint('hello https://example.com @user #tag world');
    expect(fp.has('hel')).toBe(true);
    expect(fp.has('wor')).toBe(true);
    // URL content should not appear
    expect(fp.has('exa')).toBe(false);
    expect(fp.has('com')).toBe(false);
  });

  it('returns empty set for very short text', () => {
    const fp = textFingerprint('ab');
    expect(fp.size).toBe(0);
  });
});

describe('similarity', () => {
  it('returns 1.0 for identical sets', () => {
    const a = new Set(['abc', 'bcd', 'cde']);
    expect(similarity(a, a)).toBe(1.0);
  });

  it('returns 0.0 for disjoint sets', () => {
    const a = new Set(['abc', 'bcd']);
    const b = new Set(['xyz', 'yzw']);
    expect(similarity(a, b)).toBe(0.0);
  });

  it('returns 0.0 for two empty sets', () => {
    expect(similarity(new Set(), new Set())).toBe(0.0);
  });

  it('returns correct Jaccard for partial overlap', () => {
    const a = new Set(['abc', 'bcd', 'cde']);
    const b = new Set(['abc', 'bcd', 'xyz']);
    // intersection=2, union=4 → 0.5
    expect(similarity(a, b)).toBeCloseTo(0.5);
  });
});

describe('detectCampaigns', () => {
  it('returns empty array for empty input', () => {
    expect(detectCampaigns([])).toEqual([]);
  });

  it('clusters near-identical texts with shared techniques', () => {
    const baseText = 'This is a coordinated campaign post about fear and manipulation designed to scare you into action immediately';
    const records = [
      makeRecord({ originalText: baseText, techniques: [{ name: 'fear-appeal', severity: 7, confidence: 0.9 }] }),
      makeRecord({ originalText: baseText + ' now', techniques: [{ name: 'fear-appeal', severity: 6, confidence: 0.8 }] }),
      makeRecord({ originalText: baseText + ' today', techniques: [{ name: 'fear-appeal', severity: 8, confidence: 0.85 }] }),
      makeRecord({ originalText: baseText + ' please', techniques: [{ name: 'fear-appeal', severity: 7, confidence: 0.9 }] }),
    ];

    const campaigns = detectCampaigns(records);
    expect(campaigns.length).toBe(1);
    expect(campaigns[0].records.length).toBe(4);
    expect(campaigns[0].sharedTechniques).toContain('fear-appeal');
  });

  it('does not cluster unrelated texts', () => {
    const records = [
      makeRecord({ originalText: 'The weather is nice today and I enjoy walking in the park with my friends on weekends' }),
      makeRecord({ originalText: 'Scientists discover new species of deep sea fish near the Mariana Trench in the Pacific Ocean' }),
      makeRecord({ originalText: 'Local community center offers free yoga classes every Tuesday and Thursday morning at seven am' }),
      makeRecord({ originalText: 'The annual cherry blossom festival draws thousands of visitors from around the world each spring' }),
    ];

    const campaigns = detectCampaigns(records);
    expect(campaigns.length).toBe(0);
  });

  it('requires shared techniques even for similar text', () => {
    const baseText = 'This is a very specific coordinated campaign post that should be detected as similar across all records';
    const records = [
      makeRecord({ originalText: baseText, techniques: [{ name: 'fear-appeal', severity: 7, confidence: 0.9 }] }),
      makeRecord({ originalText: baseText + ' v2', techniques: [{ name: 'bandwagon', severity: 6, confidence: 0.8 }] }),
      makeRecord({ originalText: baseText + ' v3', techniques: [{ name: 'scapegoating', severity: 8, confidence: 0.85 }] }),
    ];

    const campaigns = detectCampaigns(records);
    expect(campaigns.length).toBe(0);
  });

  it('requires minimum 3 records for a campaign', () => {
    const baseText = 'This is a coordinated campaign post that repeats the same fear-based manipulation across many accounts';
    const records = [
      makeRecord({ originalText: baseText, techniques: [{ name: 'fear-appeal', severity: 7, confidence: 0.9 }] }),
      makeRecord({ originalText: baseText + ' now', techniques: [{ name: 'fear-appeal', severity: 6, confidence: 0.8 }] }),
    ];

    const campaigns = detectCampaigns(records);
    expect(campaigns.length).toBe(0);
  });

  it('ignores records older than 24 hours', () => {
    const baseText = 'This is a coordinated campaign post about fear and manipulation designed to scare you into action immediately';
    const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const records = [
      makeRecord({ originalText: baseText, timestamp: oldTimestamp, techniques: [{ name: 'fear-appeal', severity: 7, confidence: 0.9 }] }),
      makeRecord({ originalText: baseText + ' now', timestamp: oldTimestamp, techniques: [{ name: 'fear-appeal', severity: 6, confidence: 0.8 }] }),
      makeRecord({ originalText: baseText + ' today', timestamp: oldTimestamp, techniques: [{ name: 'fear-appeal', severity: 8, confidence: 0.85 }] }),
    ];

    const campaigns = detectCampaigns(records);
    expect(campaigns.length).toBe(0);
  });
});
