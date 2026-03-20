// FeelingWise - Severity Scoring with Age Adjustment
//
// Base aggregation (from Build Guide Section 7):
//   1 technique: that technique's severity
//   2 techniques: highest + (second * 0.3), cap 10
//   3+: highest + sum(remaining * 0.2), cap 10
//
// Age modifiers: ADDED after base calculation.
// Uses highest applicable modifier across detected techniques.

import { TechniqueName, TechniqueResult } from '../types/analysis';

export type AgeGroup = 'child' | 'teen-young' | 'teen-old' | 'adult';

const AGE_MODIFIERS: Record<TechniqueName, Record<Exclude<AgeGroup, 'adult'>, number>> = {
  'shame-attack':      { 'child': 3, 'teen-young': 2, 'teen-old': 1 },
  'fear-appeal':       { 'child': 2, 'teen-young': 1, 'teen-old': 1 },
  'anger-trigger':     { 'child': 2, 'teen-young': 1, 'teen-old': 1 },
  'fomo':              { 'child': 1, 'teen-young': 3, 'teen-old': 2 },
  'bandwagon':         { 'child': 1, 'teen-young': 2, 'teen-old': 1 },
  'scapegoating':      { 'child': 1, 'teen-young': 1, 'teen-old': 1 },
  'false-urgency':     { 'child': 1, 'teen-young': 1, 'teen-old': 0 },
  'combined':          { 'child': 2, 'teen-young': 1, 'teen-old': 1 },
  'toxic-positivity':  { 'child': 0, 'teen-young': 0, 'teen-old': 0 },
  'misleading-format': { 'child': 0, 'teen-young': 0, 'teen-old': 0 },
};

export function aggregateSeverity(
  techniques: TechniqueResult[],
  ageGroup: AgeGroup = 'adult',
): number {
  const present = techniques.filter(t => t.present);
  if (present.length === 0) return 0;

  // Sort by severity descending
  const sorted = [...present].sort((a, b) => b.severity - a.severity);

  let base: number;
  if (sorted.length === 1) {
    base = sorted[0].severity;
  } else if (sorted.length === 2) {
    base = sorted[0].severity + sorted[1].severity * 0.3;
  } else {
    base = sorted[0].severity
      + sorted.slice(1).reduce((sum, t) => sum + t.severity * 0.2, 0);
  }
  base = Math.min(base, 10);

  // Age modifier: pick highest modifier across all detected techniques
  if (ageGroup !== 'adult') {
    const modifier = Math.max(
      ...present.map(t => AGE_MODIFIERS[t.technique]?.[ageGroup] ?? 0),
    );
    base = Math.min(base + modifier, 10);
  }

  return base;
}
