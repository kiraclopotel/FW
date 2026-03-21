// Suspicion scoring — lightweight heuristics to decide if a post
// that passed Layer 1 (zero regex triggers) should still be sent to Layer 2 AI.
// These are NOT manipulation detectors. They're cheap signals of "worth investigating."

export interface SuspicionScore {
  total: number;         // 0.0-1.0 combined score
  textLength: number;    // 0.0-1.0
  punctuationIntensity: number;  // 0.0-1.0
  negativeKeywords: number;      // 0.0-1.0
  capsRatio: number;     // 0.0-1.0
}

// ~80 high-signal negative/manipulative-adjacent words
// NOT technique classifiers — just "this post sounds heated"
const SUSPICION_WORDS = new Set([
  // anger/outrage
  'destroy', 'destroying', 'ruining', 'traitor', 'traitors', 'corrupt',
  'disgusting', 'pathetic', 'scum', 'vermin', 'filth', 'creature',
  'puppet', 'installed', 'stolen', 'rigged', 'plot', 'conspir',
  // fear
  'terrified', 'nightmare', 'catastrophe', 'collapse', 'deadly',
  'hiding', 'coverup', 'they dont want', 'wake up',
  // shame
  'worthless', 'pathetic', 'embarrassing', 'ashamed', 'disgusting',
  'real men', 'real women', 'no excuses',
  // urgency/fomo
  'last chance', 'act now', 'hurry', 'limited', 'exclusive', 'secret',
  'missing out', 'before its too late',
  // group blame
  'they are the reason', 'all immigrants', 'all liberals', 'all conservatives',
  'these people', 'those people', 'its their fault', 'blame',
  // general intensity
  'literally', 'absolutely', 'unbelievable', 'insane', 'criminal',
  'evil', 'monster', 'enemy', 'enemies', 'weaponized', 'dangerous',
]);

export function scoreSuspicion(text: string): SuspicionScore {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  if (totalWords === 0) {
    return { total: 0, textLength: 0, punctuationIntensity: 0, negativeKeywords: 0, capsRatio: 0 };
  }

  // 1. Text length — short posts are rarely manipulative
  // Ramp from 0 at 20 chars to 1.0 at 200+ chars
  const textLength = Math.min(1.0, Math.max(0, (text.length - 20) / 180));

  // 2. Punctuation intensity — exclamations, question marks, ellipses
  const excl = (text.match(/!/g) || []).length;
  const quest = (text.match(/\?/g) || []).length;
  const ellipsis = (text.match(/\.{2,}/g) || []).length;
  const punctScore = (excl * 2 + quest + ellipsis) / totalWords;
  const punctuationIntensity = Math.min(1.0, punctScore * 3);

  // 3. Negative/suspicious keyword density
  const lowerText = text.toLowerCase();
  let keywordHits = 0;
  for (const word of SUSPICION_WORDS) {
    if (lowerText.includes(word)) keywordHits++;
  }
  const negativeKeywords = Math.min(1.0, keywordHits / 3); // 3+ hits = max score

  // 4. CAPS ratio (excluding common acronyms — reuse the same set from misleading-format)
  const capsWords = words.filter(w => {
    const cleaned = w.replace(/[^A-Za-z]/g, '');
    return cleaned.length >= 2 && cleaned === cleaned.toUpperCase();
  });
  const capsRatio = Math.min(1.0, (capsWords.length / totalWords) * 5);

  // Weighted combination
  const total = Math.min(1.0,
    textLength * 0.15 +
    punctuationIntensity * 0.25 +
    negativeKeywords * 0.40 +
    capsRatio * 0.20
  );

  return { total, textLength, punctuationIntensity, negativeKeywords, capsRatio };
}

// Determine if a zero-trigger post should be sampled for L2 analysis
export function shouldSample(
  suspicionScore: number,
  checksUsedToday: number,
  dailyCap: number,
): boolean {
  if (dailyCap <= 0) return false; // no budget

  const remaining = Math.max(0, dailyCap - checksUsedToday);
  const budgetRatio = remaining / dailyCap; // 1.0 = full budget, 0.0 = empty

  // Base sample rate scales with remaining budget
  // Full budget: up to 40% of zero-trigger posts sampled
  // Half budget: up to 20%
  // Near empty: almost nothing sampled
  const maxSampleRate = budgetRatio * 0.4;

  // Actual rate = max rate * suspicion score
  // High suspicion + full budget = ~32% chance
  // Low suspicion + full budget = ~4% chance
  // Any suspicion + empty budget = ~0% chance
  const sampleProbability = maxSampleRate * suspicionScore;

  return Math.random() < sampleProbability;
}
