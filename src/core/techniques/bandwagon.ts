// FeelingWise - bandwagon classifier
// Detects bandwagon manipulation: false consensus, social proof pressure, isolation

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /\beveryone (knows|agrees|understands|can see|else)\b/i,
    /\ball (reasonable|smart|educated|good) people\b/i,
    /\bnobody (disagrees|denies|questions)\b/i,
    /if you (still )?(disagree|think|believe).{0,20}you'?re (the only|just|alone)/i,
    /\beveryone (else )?(cares?|is doing|supports?|sees?)\b/i,
    // Romanian false consensus: "toată lumea știe / vede / înțelege"
    /\btoat[aă] lumea ([sș]tie|vede|[îi]n[tț]elege|e de acord)\b/i,
    // Romanian "nimeni nu mai crede" (nobody believes anymore)
    /\bnimeni nu (mai )?(crede|neag[aă]|contest[aă])\b/i,
  ],
  moderate: [
    /\b(millions|thousands|everyone) (is|are) (saying|doing|switching)\b/i,
    // Romanian moderate bandwagon
    /\b(milioane|mii) de (oameni|rom[âa]ni) (spun|cred|vor|au)\b/i,
  ],
  exceptions: [
    /\b(survey|poll|study|research|data) (shows|indicates|found)\b/i,
    /\b\d+% (of|say|agree)\b/i,
  ],
};

export const bandwagonClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'bandwagon', PATTERNS);
  },
};
