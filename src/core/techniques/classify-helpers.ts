// FeelingWise - Shared classifier helper for regex-based technique classifiers
// All 8 regex classifiers use this template:
//   STRONG patterns: +3 each
//   MODERATE patterns: +1 each
//   EXCEPTION patterns: dampen score by 60%
//   present = severity >= 3
//   confidence = min(0.4 + severity * 0.04, 0.70) ← CAPPED AT 0.70

import { TechniqueName } from '../../types/analysis';
import { ClassifierOutput } from './types';

export interface PatternSet {
  strong: RegExp[];
  moderate: RegExp[];
  exceptions: RegExp[];
}

export function runPatternClassifier(
  text: string,
  technique: TechniqueName,
  patterns: PatternSet,
): ClassifierOutput {
  let score = 0;
  const evidence: string[] = [];

  for (const pat of patterns.strong) {
    const match = text.match(pat);
    if (match) {
      score += 3;
      evidence.push(match[0]);
    }
  }

  for (const pat of patterns.moderate) {
    const match = text.match(pat);
    if (match) {
      score += 1;
      evidence.push(match[0]);
    }
  }

  for (const pat of patterns.exceptions) {
    if (pat.test(text)) {
      score = Math.floor(score * 0.4); // dampen by 60%
    }
  }

  const severity = Math.min(score, 10);

  return {
    technique,
    present: severity >= 3,
    confidence: Math.min(0.4 + severity * 0.04, 0.70),
    severity,
    evidence,
  };
}
