import { describe, it, expect } from 'vitest';
import { detect } from '../../src/core/detector';

describe('detector', () => {
  it('returns 10 technique results for any input', () => {
    const results = detect('Hello world');
    expect(results).toHaveLength(10);
    const names = results.map(r => r.technique);
    expect(names).toContain('fear-appeal');
    expect(names).toContain('shame-attack');
    expect(names).toContain('anger-trigger');
    expect(names).toContain('false-urgency');
    expect(names).toContain('bandwagon');
    expect(names).toContain('scapegoating');
    expect(names).toContain('fomo');
    expect(names).toContain('toxic-positivity');
    expect(names).toContain('misleading-format');
    expect(names).toContain('combined');
  });

  it('returns all not-present for benign text', () => {
    const results = detect('I had a lovely breakfast this morning');
    const present = results.filter(r => r.present);
    expect(present).toHaveLength(0);
  });

  it('detects shame-attack and misleading-format in test tweet', () => {
    const results = detect(
      "You're DISGUSTING if you don't have a beach body by summer. NO EXCUSES."
    );
    const present = results.filter(r => r.present);
    const names = present.map(r => r.technique);
    expect(names).toContain('shame-attack');
    expect(names).toContain('misleading-format');
  });

  it('combined triggers when 3+ techniques present', () => {
    // Text designed to trigger fear-appeal, shame-attack, and anger-trigger
    const text =
      "You're pathetic if you ignore this. These traitors are destroying everything. " +
      "If you don't act, your family will suffer. NO EXCUSES.";
    const results = detect(text);
    const present = results.filter(r => r.present);
    const names = present.map(r => r.technique);
    expect(names).toContain('combined');
  });

  it('combined does not trigger with fewer than 3 techniques', () => {
    const results = detect(
      "You're DISGUSTING if you don't have a beach body by summer. NO EXCUSES."
    );
    const combined = results.find(r => r.technique === 'combined')!;
    expect(combined.present).toBe(false);
  });

  it('returns results with correct shape', () => {
    const results = detect('test text');
    for (const r of results) {
      expect(r).toHaveProperty('technique');
      expect(r).toHaveProperty('present');
      expect(r).toHaveProperty('confidence');
      expect(r).toHaveProperty('severity');
      expect(r).toHaveProperty('evidence');
      expect(typeof r.present).toBe('boolean');
      expect(typeof r.confidence).toBe('number');
      expect(typeof r.severity).toBe('number');
      expect(Array.isArray(r.evidence)).toBe(true);
    }
  });

  it('runs under 5ms for typical tweet-length text', () => {
    const text = 'This is a normal tweet about my day, nothing special happening here.';
    const start = performance.now();
    detect(text);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });
});
