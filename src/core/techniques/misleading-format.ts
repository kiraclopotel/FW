// FeelingWise - misleading-format classifier
// Structural analysis (NOT regex-based): ALL-CAPS density, emoji density, exclamation density
// Detects formatting tricks used to bypass rational processing

import { ClassifierInput, ClassifierOutput, TechniqueClassifier } from './types';

// Common acronyms that should NOT count as ALL-CAPS manipulation
const ACRONYMS = new Set([
  'USA', 'FBI', 'CIA', 'NASA', 'NFL', 'NBA', 'MLB', 'NHL', 'UFC',
  'CEO', 'CFO', 'CTO', 'COO', 'VP', 'HR', 'PR', 'IT', 'AI', 'ML',
  'UN', 'EU', 'UK', 'US', 'GDP', 'GPA', 'GPS', 'HIV', 'AIDS',
  'DNA', 'RNA', 'PDF', 'URL', 'API', 'CSS', 'HTML', 'SQL', 'PHP',
  'AM', 'PM', 'TV', 'PC', 'OK', 'ID', 'IQ', 'DIY', 'FAQ', 'FYI',
  'ASAP', 'RSVP', 'ATM', 'PIN', 'SIM', 'USB', 'WIFI', 'LOL',
  'OMG', 'BTW', 'IMO', 'IMHO', 'TBH', 'SMH', 'DM', 'RT',
]);

// Emoji detection: matches most common Unicode emoji ranges
const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu;

export const misleadingFormatClassifier: TechniqueClassifier = {
  classify(input: ClassifierInput): ClassifierOutput {
    const { text } = input;
    const evidence: string[] = [];
    let score = 0;

    // Split into words (filter empty strings)
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;

    if (totalWords === 0) {
      return {
        technique: 'misleading-format',
        present: false,
        confidence: 0.4,
        severity: 0,
        evidence: [],
      };
    }

    // 0. ALL-CAPS prefix manipulation: MUST-WATCH, BREAKING, URGENT etc. at start of text
    const capsPrefix = /^(MUST[- ]?(WATCH|SEE|READ|SHARE|KNOW)|BREAKING|URGENT|ALERT|EXPOSED|LEAKED|BOMBSHELL|SHOCK(ING)?)\s*[:\-!]/;
    if (capsPrefix.test(text.trim())) {
      score += 3;
      evidence.push(`manipulative ALL-CAPS prefix: "${text.trim().match(capsPrefix)?.[0]}"`);
    }

    // 1. Count ALL-CAPS words (length >= 2, excluding acronyms)
    // Strip trailing punctuation before checking
    const capsWords = words.filter(w => {
      const cleaned = w.replace(/[^A-Za-z]/g, '');
      return cleaned.length >= 2
        && cleaned === cleaned.toUpperCase()
        && !ACRONYMS.has(cleaned);
    });
    const capsCount = capsWords.length;
    const capsRatio = capsCount / totalWords;

    if (capsRatio > 0.12) {
      score += 3;
      evidence.push(`caps ratio ${capsRatio.toFixed(2)} (${capsCount}/${totalWords} words)`);
    } else if (capsCount > 0) {
      score += capsCount * 0.5;
      evidence.push(`${capsCount} ALL-CAPS word(s)`);
    }

    // 2. Emoji density
    const emojis = text.match(EMOJI_PATTERN);
    const emojiCount = emojis ? emojis.length : 0;
    const emojiDensity = emojiCount / totalWords;

    if (emojiDensity > 0.15) {
      score += 2;
      evidence.push(`emoji density ${emojiDensity.toFixed(2)} (${emojiCount} emojis)`);
    }

    // 3. Exclamation density
    const exclCount = (text.match(/!/g) || []).length;
    // Count sentences by splitting on sentence-ending punctuation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = Math.max(sentences.length, 1);
    const exclDensity = exclCount / sentenceCount;

    if (exclDensity > 0.3) {
      score += 2;
      evidence.push(`exclamation density ${exclDensity.toFixed(2)} (${exclCount} in ${sentenceCount} sentences)`);
    }

    const severity = Math.min(Math.floor(score), 10);

    return {
      technique: 'misleading-format',
      present: severity >= 3,
      confidence: Math.min(0.4 + severity * 0.04, 0.70),
      severity,
      evidence,
    };
  },
};
