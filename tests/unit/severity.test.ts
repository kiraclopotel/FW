import { describe, it, expect } from 'vitest';
import { aggregateSeverity, AgeGroup } from '../../src/core/severity';
import { TechniqueResult } from '../../src/types/analysis';

function makeTechnique(
  technique: TechniqueResult['technique'],
  severity: number,
  present = true,
): TechniqueResult {
  return { technique, present, confidence: 0.5, severity, evidence: [] };
}

describe('severity scoring', () => {
  it('returns 0 when no techniques present', () => {
    const result = aggregateSeverity([
      makeTechnique('fear-appeal', 5, false),
      makeTechnique('shame-attack', 3, false),
    ]);
    expect(result).toBe(0);
  });

  it('returns technique severity for single technique', () => {
    const result = aggregateSeverity([makeTechnique('shame-attack', 6)]);
    expect(result).toBe(6);
  });

  it('aggregates two techniques: highest + second * 0.3', () => {
    const result = aggregateSeverity([
      makeTechnique('shame-attack', 6),
      makeTechnique('misleading-format', 4),
    ]);
    // 6 + 4*0.3 = 7.2
    expect(result).toBeCloseTo(7.2, 1);
  });

  it('aggregates three+ techniques: highest + remaining * 0.2', () => {
    const result = aggregateSeverity([
      makeTechnique('shame-attack', 6),
      makeTechnique('fear-appeal', 4),
      makeTechnique('anger-trigger', 3),
    ]);
    // 6 + (4*0.2 + 3*0.2) = 6 + 1.4 = 7.4
    expect(result).toBeCloseTo(7.4, 1);
  });

  it('caps base at 10', () => {
    const result = aggregateSeverity([
      makeTechnique('shame-attack', 10),
      makeTechnique('fear-appeal', 10),
      makeTechnique('anger-trigger', 10),
      makeTechnique('fomo', 10),
      makeTechnique('bandwagon', 10),
    ]);
    expect(result).toBeLessThanOrEqual(10);
  });

  it('applies child age modifier', () => {
    const base = aggregateSeverity(
      [makeTechnique('shame-attack', 5)],
      'adult',
    );
    const child = aggregateSeverity(
      [makeTechnique('shame-attack', 5)],
      'child',
    );
    // child gets +3 for shame-attack
    expect(child).toBe(Math.min(base + 3, 10));
  });

  it('applies teen-young age modifier for fomo', () => {
    const base = aggregateSeverity(
      [makeTechnique('fomo', 4)],
      'adult',
    );
    const teen = aggregateSeverity(
      [makeTechnique('fomo', 4)],
      'teen-young',
    );
    // teen-young gets +3 for fomo
    expect(teen).toBe(Math.min(base + 3, 10));
  });

  it('caps final score at 10 with age modifier', () => {
    const result = aggregateSeverity(
      [makeTechnique('shame-attack', 9)],
      'child',
    );
    // 9 + 3 = 12, capped at 10
    expect(result).toBe(10);
  });

  it('uses highest modifier across detected techniques', () => {
    const result = aggregateSeverity(
      [
        makeTechnique('shame-attack', 5),  // child modifier: 3
        makeTechnique('fear-appeal', 4),   // child modifier: 2
      ],
      'child',
    );
    // base = 5 + 4*0.3 = 6.2, modifier = max(3, 2) = 3
    // final = min(6.2 + 3, 10) = 9.2
    expect(result).toBeCloseTo(9.2, 1);
  });

  it('no modifier for adult', () => {
    const adult = aggregateSeverity(
      [makeTechnique('shame-attack', 5)],
      'adult',
    );
    expect(adult).toBe(5);
  });

  it('ignores not-present techniques', () => {
    const result = aggregateSeverity([
      makeTechnique('shame-attack', 6, true),
      makeTechnique('fear-appeal', 8, false), // not present
    ]);
    expect(result).toBe(6); // only shame-attack counts
  });
});
