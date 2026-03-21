// FeelingWise - fomo classifier
// Detects FOMO manipulation: exclusivity pressure, fear of missing out, secret knowledge

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /\byou'?re missing out\b/i,
    /\b(exclusive|members only|invite only|limited access)\b/i,
    /\bdon'?t (miss|let this pass|regret)\b/i,
    /\bmiss out (forever|on this)\b/i,
    /\bonly available (for|until|today)\b/i,
    /\bsecret (method|trick|hack|way|formula)\b/i,
    // "they don't want you to have this" — gatekeeping FOMO
    /\b(they|the elite|the rich) don'?t want you to (have|use|know about) this\b/i,
    // Romanian FOMO
    /\bnu rata\b/i,
    /\b(acces exclusiv|edi[tț]ie limitat[aă]|locuri limitate)\b/i,
  ],
  moderate: [
    // Romanian moderate FOMO
    /\b(o s[aă] regre[tț]i|nu l[aă]sa s[aă] treac[aă]|ultimele locuri)\b/i,
  ],
  exceptions: [
    /\b(event|concert|show|game) (tickets|registration)\b/i,
  ],
};

export const fomoClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'fomo', PATTERNS);
  },
};
