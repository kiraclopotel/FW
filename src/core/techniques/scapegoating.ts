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
    // Conspiracy attribution: "[entity] installed/planted/put [person] in power"
    /\b(CIA|FBI|deep state|Soros|they|the left|the right)\b.{0,30}\b(installed|planted|put|placed)\b/i,
    /\b(installed|planted|put|placed)\b.{0,20}\b(in power|in office|in charge|as president|as leader)\b/i,
    // Deep state / shadow government conspiracy
    /\b(deep state|shadow government|new world order|cabal|puppet master|handlers?)\b/i,
    // "they put her/him there" pattern
    /\bthey (put|placed|installed) (him|her|them) there\b/i,
    // Romanian scapegoating: "ei/aceștia ne-au distrus / ne-au vândut / i-au pus la putere"
    /\b(ei|ace[sș]tia|aia|[aă][sș]tia) (ne-?au|au|i-?au)\b.{0,30}\b(distrus|v[âa]ndut|f[aă]cut|pus|b[aă]gat|adus)\b/i,
    // Romanian "X a fost pus/instalat de Y" (X was put/installed by Y)
    /\b(pus|instalat|plasat|plantat|b[aă]gat)\w*\b.{0,15}\b(de|la comanda)\b/i,
    // Romanian group blame: "toți [group] sunt..."
    /\bto[tț]i\b.{0,20}\b(sunt|is|fac|vor)\b/i,
  ],
  moderate: [
    // Othering vocabulary (English)
    /\b(globalist|elitist|the establishment|ruling class|oligarch)\w*\b/i,
    // "because of [group]" pattern
    /\bbecause of (the|those|these|all the)\b/i,
    // Romanian moderate scapegoating: "din cauza lor / din vina lor"
    /\b(din cauza|din vina|pe (capul|spatele|seama))\b.{0,15}\b(lor|acestora|[aă]stora)\b/i,
  ],
  exceptions: [
    /\b(policy|legislation|decision|action) (led to|caused|resulted)\b/i,
  ],
};

export const scapegoatingClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    return runPatternClassifier(input.text, 'scapegoating', PATTERNS);
  },
};
