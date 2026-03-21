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
    // "fake person" / "fakeness" — character assassination
    /\b(fake (person|human|people)|fakeness|phon(y|ey|ie)|fraud|charlatan|impostor)\b/i,
    // "[person] is the [disliked-person] of [context]" — character assassination by comparison
    /\bis (the|a|another|our|basically) .{0,20}(hitler|stalin|devil|satan|judas|antichrist|cancer|plague|disease)\b/i,
    // "a version of [disliked person]" pattern
    /\b(version|clone|copy|reincarnation) of\b.{0,20}\b(hitler|stalin|devil|satan|ceausescu|mao|mussolini)\b/i,
    // Romanian shame vocabulary
    // "rușine / rușinos / ar trebui să-ți fie rușine"
    /\b(ru[sș]ine|ru[sș]inos|s[aă]-[tț]i fie ru[sș]ine|n-ai pic de)\b/i,
    // Romanian identity shaming: "ești doar un/o..." (you're just a...)
    /\be[sș]ti (doar |numai )?(un |o )?(prost|proast[aă]|idiot|analfabet|incult|needucat|ignorant)\w*\b/i,
  ],
  moderate: [
    /\b(loser|failure|weak|coward|snowflake)\b/i,
    /imagine (being|thinking|believing)/i,
    // Dismissive shame: "clown", "joke", "embarrassment"
    /\b(clown|joke|embarrassment|disgrace|laughingstock|sellout)\b/i,
    // Romanian moderate shame
    /\b(penibil|jalnic|ridicol|lamentabil|mediocru|nesim[tț]it)\w*\b/i,
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
