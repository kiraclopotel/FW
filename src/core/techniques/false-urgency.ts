// FeelingWise - false-urgency classifier
// Detects urgency-based manipulation: artificial deadlines, pressure tactics, scarcity
//
// Includes a MODERATE pattern for implicit deadlines ("by summer", "by next month")
// that alone cannot trigger detection (needs severity >= 3) but contributes when
// combined with other urgency signals or amplifies compound manipulation for Layer 2.

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /\b(LAST CHANCE|NOW OR NEVER|LIMITED TIME|ACT NOW|HURRY)\b/,
    // MUST-WATCH/MUST-SEE/MUST-READ — common social media urgency markers (case-sensitive)
    /\bMUST[- ]?(WATCH|SEE|READ|SHARE|KNOW)\b/,
    /only \d+ (left|remaining|spots|seats|available)/i,
    /\b(expires?|ending) (today|tonight|midnight|in \d+)/i,
    /don'?t (wait|hesitate|think|delay)/i,
    /\bshare this NOW\b/i,
    /(in|for) the next \d+ (minutes?|hours?|days?)/i,
    /\bclock is ticking\b/i,
    /\bbefore it'?s too late\b/i,
    // Romanian urgency (case-sensitive for ALL-CAPS versions)
    /\b(ULTIMA [SȘ]ANS[AĂ]|URGENT|GR[AĂ]BI[TȚ]I-V[AĂ]|AC[TȚ]IONA[TȚ]I ACUM)\b/,
    // Romanian "trebuie să vezi/știi/citești" (you MUST see/know/read)
    /\btrebuie s[aă] (vezi|[sș]tii|cite[sș]ti|distribui|afli)\b/i,
  ],
  moderate: [
    /\b(urgent|immediately|right now)\b/i,
    // Implicit deadlines: catches "have a beach body by summer" but not
    // legitimate scheduling (filtered by exception list: deadline, due date, etc.)
    /\b(have|need|must|got to|gotta|better)\b.{0,30}\bby (summer|winter|spring|fall|next (week|month|year)|tomorrow|tonight|the end of)\b/i,
    // Romanian moderate urgency
    /\b(imediat|acum|repede|f[aă]r[aă] [îi]nt[âa]rziere|nu a[sș]tepta)\b/i,
    // "going viral" / "spreading fast" urgency pressure
    /\b(going viral|spreading fast|blowing up|before (this|it) gets? taken down)\b/i,
  ],
  exceptions: [
    /\b(deadline|due date|submission|filing|registration closes)\b/i,
  ],
};

export const falseUrgencyClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'false-urgency', PATTERNS);
  },
};
