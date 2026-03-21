// FeelingWise - anger-trigger classifier
// Detects anger-based manipulation: dehumanization, outrage bait, guilt-tripping

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';
import { PatternSet, runPatternClassifier } from './classify-helpers';

const PATTERNS: PatternSet = {
  strong: [
    /\b(traitors?|scum|vermin|parasites?|cockroach|subhuman|filth)\b/i,
    // Dehumanizing nouns used in political/social manipulation
    /\b(creature|puppet|puppets?|animal|animals|rat|rats|snake|snakes|worm|worms|insect|insects|pest|pests|maggot|garbage|sewage)\b/i,
    /(they'?re|are) (destroy|ruin|steal|taking|corrupt)(ing)? (everything|our|your)/i,
    /\bwake up (sheeple|people|america|world)\b/i,
    /they (don'?t care|laugh at you|hate you|want you to suffer)/i,
    /\b(DYING|KILLING|MURDERED|DESTROYED)\b/,
    /you'?re (scrolling past|ignoring|doing nothing) while/i,
    // Political manipulation: installed/planted/weaponized framing
    /\b(installed|planted|weaponized|infiltrat\w*)\b.*\b(by|to|against|in)\b/i,
    // "I present to you" + dehumanizing — rhetorical attack introduction
    /\bi present to you\b/i,
    // "[person] wants to take everything you have" pattern
    /wants? to take (everything|all|what) (you|we) (have|own|built|earned)/i,
    // "sold out" / "bought and paid for" — corruption accusation
    /\b(sold? (us |you |them )?out|bought and paid for|on the payroll)\b/i,
    // Political buzzword dehumanization
    /\b(regime|takeover|invasion|replacement)\b.*\b(our|your|the)\b/i,
    // Romanian dehumanization & outrage vocabulary
    // Uses [șş] / [țţ] / [ăa] / [îi] alternations for diacritic-flexible matching
    /\b(tr[aă]d[aă]tor|parazit|incompeten[tț]|marionet[aă]|corup[tț]|jigodie|lichea|lepra|javr[aă]|gunoi|j[ei]gos|mizerabil|tic[aă]lo[sș]|criminal|ho[tț]|bandit)\w*\b/i,
    // Romanian "ne fură / ne distrug / ne vând" (they steal from us / destroy us / sell us)
    /\b(ne|v[aă]|[îi]i) (fur[aă]|distrug|v[âa]nd|mint|manipuleaz[aă]|otr[aă]ve[sș]c|terorizea?z[aă])\w*\b/i,
  ],
  moderate: [
    /\b(outrag|infuriat|enrag|disgrac|unforgivable)\b/i,
    // Political othering terms
    /\b(globalist|elitist|swamp|establishment|radical|extremist)\b/i,
    // Accusation framing
    /\b(sold out|sellout|traitor to)\b/i,
    // Romanian moderate outrage
    /\b(ru[sș]ine|revolt[aă]|scan?dal|abuz|arogant[aă]?|nesim[tț]i\w*|obraznic\w*|tupeu)\b/i,
    // Romanian "trezește-te" (wake up) — equivalent to "wake up sheeple"
    /\btrez(e[sș]te|i[tț]i)[-\s]*(te|v[aă])\b/i,
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
