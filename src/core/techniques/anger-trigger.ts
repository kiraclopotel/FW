// FeelingWise - anger-trigger classifier
// Detects anger-based manipulation: dehumanization, outrage bait, guilt-tripping

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /\b(traitors?|scum|vermin|parasites?|cockroach|subhuman|filth)\b/i,
    /(they'?re|are) (destroy|ruin|steal|taking|corrupt)(ing)? (everything|our|your)/i,
    /\bwake up (sheeple|people|america|world)\b/i,
    /they (don'?t care|laugh at you|hate you|want you to suffer)/i,
    /\b(DYING|KILLING|MURDERED|DESTROYED)\b/,
    /you'?re (scrolling past|ignoring|doing nothing) while/i,
  ],
  moderate: [
    /\b(outrag|infuriat|enrag|disgrac|unforgivable)\b/i,
  ],
  exceptions: [
    /\b(i'?m (angry|frustrated|upset|mad))\b/i,
    /\b(editorial|opinion|commentary)\b/i,
  ],
};

export const angerTriggerClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'anger-trigger', PATTERNS);
  },
};
