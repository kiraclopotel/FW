import { describe, it, expect } from 'vitest';
import { scoreSuspicion, shouldSample } from '../../src/core/suspicion';

describe('suspicion scoring', () => {
  it('scores benign text low', () => {
    const result = scoreSuspicion('Had a great day at the park with the kids');
    expect(result.total).toBeLessThan(0.2);
  });

  it('scores heated political text higher', () => {
    const result = scoreSuspicion(
      'I present to you the creature the CIA literally installed in Virginia to destroy the state'
    );
    expect(result.total).toBeGreaterThan(0.3);
  });

  it('scores obvious manipulation high', () => {
    const result = scoreSuspicion(
      'These TRAITORS are DESTROYING everything! Wake up people! They are the enemy!'
    );
    expect(result.total).toBeGreaterThan(0.6);
  });

  it('scores empty text as zero', () => {
    const result = scoreSuspicion('');
    expect(result.total).toBe(0);
  });

  it('scores short text low regardless of content', () => {
    const result = scoreSuspicion('evil!');
    expect(result.textLength).toBeLessThan(0.1);
  });
});

describe('sampling decision', () => {
  it('never samples with zero budget', () => {
    // Run 100 times — should never sample
    let sampled = 0;
    for (let i = 0; i < 100; i++) {
      if (shouldSample(1.0, 200, 200)) sampled++;
    }
    expect(sampled).toBe(0);
  });

  it('samples more with full budget and high suspicion', () => {
    let sampled = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldSample(0.8, 0, 200)) sampled++;
    }
    // With 0.8 suspicion and full budget: ~32% rate
    // In 1000 trials: expect ~320, allow wide range
    expect(sampled).toBeGreaterThan(150);
    expect(sampled).toBeLessThan(500);
  });

  it('rarely samples with low suspicion', () => {
    let sampled = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldSample(0.1, 0, 200)) sampled++;
    }
    // With 0.1 suspicion and full budget: ~4% rate
    expect(sampled).toBeLessThan(100);
  });
});
