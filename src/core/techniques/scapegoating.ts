// FeelingWise - scapegoating classifier
// Detects scapegoating manipulation: group blame, othering, conspiracy attribution

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /\b(they|those people|these people) (are|is) (the reason|why|responsible for|to blame|destroying|ruining)\b/i,
    /\b(all|every) (immigrants|liberals|conservatives|boomers|millennials|men|women) (are|do|want)\b/i,
    /\bblame (the|those|these)\b/i,
    /\bit'?s (all )?(their|his|her) fault\b/i,
    /\b(traitors?|enemies) in (government|congress|parliament|power)\b/i,
  ],
  moderate: [],
  exceptions: [
    /\b(policy|legislation|decision|action) (led to|caused|resulted)\b/i,
  ],
};

export const scapegoatingClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'scapegoating', PATTERNS);
  },
};
