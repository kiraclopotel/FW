// FeelingWise - Layer 1 Detection Engine
// Runs content through all 10 technique classifiers (regex-based + structural)
//
// Layer 1 confidence is CAPPED at 0.70 — regex cannot understand context.
// Posts with ZERO pattern triggers are PASSED immediately (~60-80% of content).
// Posts with triggers get preliminary TechniqueResult[] sent to Layer 2.

import { TechniqueResult } from '../types/analysis';
import { ClassifierInput } from './techniques/types';
import { classifiers, classifyCombined } from './techniques';

export function detect(
  text: string,
  author?: string,
  platform?: string,
): TechniqueResult[] {
  const input: ClassifierInput = { text, author, platform };

  // Run all 9 individual classifiers
  const results = classifiers.map(c => c.classify(input));

  // Run meta-classifier (triggers when 3+ techniques co-occur)
  const combined = classifyCombined(results);

  return [...results, combined];
}
