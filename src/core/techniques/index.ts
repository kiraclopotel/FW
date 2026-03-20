// FeelingWise - Technique classifier registry
// Exports all classifiers as array for detector iteration

import { TechniqueClassifier } from './types';
import { fearAppealClassifier } from './fear-appeal';
import { shameAttackClassifier } from './shame-attack';
import { angerTriggerClassifier } from './anger-trigger';
import { falseUrgencyClassifier } from './false-urgency';
import { bandwagonClassifier } from './bandwagon';
import { scapegoatingClassifier } from './scapegoating';
import { fomoClassifier } from './fomo';
import { toxicPositivityClassifier } from './toxic-positivity';
import { misleadingFormatClassifier } from './misleading-format';

export { classifyCombined } from './combined';

// All 9 individual classifiers (combined is separate — it needs their results)
export const classifiers: TechniqueClassifier[] = [
  fearAppealClassifier,
  shameAttackClassifier,
  angerTriggerClassifier,
  falseUrgencyClassifier,
  bandwagonClassifier,
  scapegoatingClassifier,
  fomoClassifier,
  toxicPositivityClassifier,
  misleadingFormatClassifier,
];
