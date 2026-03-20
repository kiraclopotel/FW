import { describe, it, expect } from 'vitest';
import { classifyCombined } from '../../src/core/techniques';
import { ClassifierOutput } from '../../src/core/techniques/types';

function makeOutput(
  technique: ClassifierOutput['technique'],
  present: boolean,
): ClassifierOutput {
  return { technique, present, confidence: 0.5, severity: present ? 5 : 0, evidence: [] };
}

describe('combined meta-classifier', () => {
  it('does not trigger with 0 present techniques', () => {
    const results = [
      makeOutput('fear-appeal', false),
      makeOutput('shame-attack', false),
    ];
    const result = classifyCombined(results);
    expect(result.present).toBe(false);
    expect(result.technique).toBe('combined');
  });

  it('does not trigger with 2 present techniques', () => {
    const results = [
      makeOutput('fear-appeal', true),
      makeOutput('shame-attack', true),
      makeOutput('anger-trigger', false),
    ];
    const result = classifyCombined(results);
    expect(result.present).toBe(false);
  });

  it('triggers with 3 present techniques', () => {
    const results = [
      makeOutput('fear-appeal', true),
      makeOutput('shame-attack', true),
      makeOutput('anger-trigger', true),
    ];
    const result = classifyCombined(results);
    expect(result.present).toBe(true);
    expect(result.severity).toBe(3);
    expect(result.evidence).toHaveLength(3);
  });

  it('severity equals count of present techniques (capped at 10)', () => {
    const results = [
      makeOutput('fear-appeal', true),
      makeOutput('shame-attack', true),
      makeOutput('anger-trigger', true),
      makeOutput('fomo', true),
      makeOutput('bandwagon', true),
    ];
    const result = classifyCombined(results);
    expect(result.severity).toBe(5);
  });

  it('evidence contains technique names', () => {
    const results = [
      makeOutput('fear-appeal', true),
      makeOutput('shame-attack', true),
      makeOutput('anger-trigger', true),
    ];
    const result = classifyCombined(results);
    expect(result.evidence).toContain('fear-appeal');
    expect(result.evidence).toContain('shame-attack');
    expect(result.evidence).toContain('anger-trigger');
  });

  it('caps confidence at 0.70', () => {
    const results = Array.from({ length: 9 }, (_, i) =>
      makeOutput('fear-appeal', true),
    );
    const result = classifyCombined(results);
    expect(result.confidence).toBeLessThanOrEqual(0.70);
  });
});
