// FeelingWise - shame-attack classifier
// Detects shame-based manipulation: identity attacks, conditional worth, gatekeeping

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /you'?re (disgusting|pathetic|worthless|trash|a joke|embarrassing|terrible|horrible|awful) if/i,
    /you'?re .{0,10}(disgusting|pathetic|worthless|terrible|horrible) (person|human)/i,
    /\b(real|true|good) (men|women|parents|people) (would|don'?t|always)/i,
    /no (real |true )?(man|woman|parent|person) would/i,
    /what'?s wrong with you/i,
    /you should be (ashamed|embarrassed)/i,
    /you'?re just (uneducated|ignorant|stupid|dumb|blind|clueless)/i,
    /\bNO EXCUSES\b/,
  ],
  moderate: [
    /\b(loser|failure|weak|coward|snowflake)\b/i,
    /imagine (being|thinking|believing)/i,
  ],
  exceptions: [
    /\b(self-reflection|accountability)\b/i,
    /\b(i feel ashamed|i'?m embarrassed)\b/i,
  ],
};

export const shameAttackClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'shame-attack', PATTERNS);
  },
};
