// FeelingWise - fear-appeal classifier
// Detects fear-based manipulation: catastrophizing, hidden threats, fear of consequences

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /if you don'?t .{0,30} (it'?ll be too late|you'?ll regret|your .{0,20} will suffer)/i,
    /\b(catastroph|doomsday|apocalyp|end of the world|total collapse|extinction)\b/i,
    /\b(terrif|horrif|nightmare|devastating|deadly|lethal|fatal)\b.*\b(you|your|children|family)\b/i,
    /we (only )?have (less than )?\d+ (years?|months?|days?|hours?) (left|before|until)/i,
    /\bdon'?t want you to know\b/i,
    /\b(they|doctors?|experts?) (are )?(hiding|don'?t want|won'?t tell)\b/i,
  ],
  moderate: [
    /\b(danger|threat|crisis|emergency|alarming)\b/i,
    /\b(warn|alert|beware)\b/i,
  ],
  exceptions: [
    /\b(according to|reported by|officials say|data shows|study finds)\b/i,
    /\b(i'?m (scared|afraid|worried))\b/i,
  ],
};

export const fearAppealClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'fear-appeal', PATTERNS);
  },
};
