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
    // Conspiracy framing: forbidden knowledge patterns
    /\b(they don'?t want you to see this|what they'?re hiding|the truth about)\b/i,
    /\b(what .{0,20} (doesn'?t|don'?t|won'?t) want you to (see|know|hear|find out))\b/i,
    /\b(banned|censored|silenced|suppressed) (video|truth|information|post|footage)\b/i,
    /\b(before (they|it) (delete|remove|take down|censor))\b/i,
    // Romanian fear vocabulary
    // "nu vor să știi / nu vor să vezi" (they don't want you to know/see)
    /\bnu vor\b.{0,15}\b(s[aă] [sș]ti[ie]|s[aă] vez|s[aă] afli|s[aă] descoperi)\b/i,
    // Romanian catastrophizing
    /\b(catastrofa?l?[aă]?|dezastru|apocalips[aă]?|pr[aă]bu[sș]ire|sf[âa]r[sș]it)\w*\b/i,
    // Romanian "adevărul despre" (the truth about)
    /\b(adev[aă]rul despre|ce (nu|ascund|se ascunde))\b/i,
  ],
  moderate: [
    /\b(danger|threat|crisis|emergency|alarming)\b/i,
    /\b(warn|alert|beware)\b/i,
    // "share before they delete" / viral urgency fear
    /\bshare (before|this before)\b/i,
    // Romanian moderate fear
    /\b(pericol|amenin[tț]are|criz[aă]|alarm[aă]|aten[tț]ie)\w*\b/i,
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
