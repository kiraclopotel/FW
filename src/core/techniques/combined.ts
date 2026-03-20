// FeelingWise - combined (meta) classifier
// Triggers when 3+ other manipulation techniques are detected simultaneously
// Compound manipulation is more dangerous than any single technique

import { ClassifierOutput } from './types';

export function classifyCombined(results: ClassifierOutput[]): ClassifierOutput {
  const presentTechniques = results.filter(
    r => r.present && r.technique !== 'combined',
  );
  const count = presentTechniques.length;

  return {
    technique: 'combined',
    present: count >= 3,
    severity: Math.min(count, 10),
    confidence: Math.min(0.4 + count * 0.06, 0.70),
    evidence: presentTechniques.map(r => r.technique),
  };
}
