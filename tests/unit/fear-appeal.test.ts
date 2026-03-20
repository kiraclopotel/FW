import { describe, it, expect } from 'vitest';
import { fearAppealClassifier } from '../../src/core/techniques/fear-appeal';

const classify = (text: string) => fearAppealClassifier.classify({ text });

describe('fear-appeal classifier', () => {
  it('detects catastrophizing language', () => {
    const result = classify('This is a doomsday scenario for your family');
    expect(result.present).toBe(true);
    expect(result.technique).toBe('fear-appeal');
    expect(result.severity).toBeGreaterThanOrEqual(3);
  });

  it('detects hidden threat patterns', () => {
    const result = classify("They don't want you to know the real truth");
    expect(result.present).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('detects consequence threats', () => {
    const result = classify("If you don't act now, your children will suffer");
    expect(result.present).toBe(true);
  });

  it('detects countdown urgency with fear', () => {
    const result = classify('We only have 5 years before total collapse');
    expect(result.present).toBe(true);
  });

  it('does not trigger on benign text', () => {
    const result = classify('The weather is nice today and I feel great');
    expect(result.present).toBe(false);
    expect(result.severity).toBe(0);
  });

  it('dampens score for reporting language', () => {
    const plain = classify('This is a doomsday crisis for everyone');
    const withException = classify('According to officials, this crisis is alarming');
    expect(withException.severity).toBeLessThanOrEqual(plain.severity);
  });

  it('dampens score for personal emotion expression', () => {
    const result = classify("I'm scared about the danger ahead");
    // personal emotion + moderate pattern, dampened
    expect(result.severity).toBeLessThan(3);
  });

  it('caps confidence at 0.70', () => {
    const result = classify(
      "Doomsday apocalypse! They are hiding deadly threats. If you don't stop it'll be too late. We have 3 days left. Doctors won't tell you!"
    );
    expect(result.confidence).toBeLessThanOrEqual(0.70);
  });

  it('always returns technique name fear-appeal', () => {
    const result = classify('Just a normal sentence');
    expect(result.technique).toBe('fear-appeal');
  });
});
