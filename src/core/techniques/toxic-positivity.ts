// FeelingWise - toxic-positivity classifier
// Detects toxic positivity manipulation: emotion dismissal, forced gratitude, comparison

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /\bjust (think positive|be happy|smile|stay positive|look on the bright side)\b/i,
    /\b(good vibes only|no negativity|stop complaining|be grateful)\b/i,
    /\beverything happens for a reason\b/i,
    /\b(other people have it worse|at least you)\b/i,
  ],
  moderate: [],
  exceptions: [
    /\b(cognitive (behavioral|reframing)|therapy|counseling)\b/i,
    /\b(I try to|it helps me to|personally I)\b/i,
  ],
};

export const toxicPositivityClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'toxic-positivity', PATTERNS);
  },
};
