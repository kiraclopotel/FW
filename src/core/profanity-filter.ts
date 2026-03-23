// FeelingWise - Profanity filter for child mode
// Pure string matching — <1ms execution, no AI calls needed.
// Child mode: replaces profane words with asterisks.
// Teen mode: flags only (doesn't modify text).
// Adult mode: skips entirely.

import type { Mode } from '../types/mode';

export interface ProfanityResult {
  filtered: boolean;
  cleanText: string;
  matches: string[];
}

// ─── Word lists ───

const ENGLISH_PROFANITY = new Set([
  // Sexual content
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'cock', 'pussy', 'cunt',
  'tits', 'boobs', 'dildo', 'orgasm', 'blowjob', 'handjob', 'cumshot',
  'porn', 'hentai', 'milf', 'anal', 'cum', 'jizz', 'whore', 'slut',
  'hooker', 'prostitute', 'masturbat', 'erection', 'penis', 'vagina',
  'clitoris', 'butthole', 'asshole', 'arsehole',
  // Slurs
  'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'tranny', 'retard',
  'spic', 'chink', 'kike', 'wetback', 'cracker',
  // Extreme violence
  'rape', 'rapist', 'molest', 'pedophile', 'paedophile', 'necrophilia',
  'bestiality', 'gore', 'dismember', 'decapitat', 'mutilat',
  // Drug references
  'cocaine', 'heroin', 'methamphetamine', 'meth', 'crack', 'ecstasy',
  'fentanyl', 'ketamine',
]);

const ROMANIAN_PROFANITY = new Set([
  // Sexual/vulgar
  'pula', 'pizda', 'fut', 'futu', 'futut', 'muie', 'curva', 'tarfa',
  'coaie', 'cacat', 'pizdă', 'pulă', 'curvă', 'târfă', 'căcat',
  // Slurs/insults (extreme)
  'bulangiu', 'poponar', 'labagiu', 'handicapat', 'retardat',
  'sugipula', 'sugipulă',
  // Violence
  'violat', 'viol',
]);

// ─── Evasion normalization ───

function normalize(word: string): string {
  return word
    .toLowerCase()
    // Common letter substitutions
    .replace(/[*]/g, '')       // f*ck → fck
    .replace(/0/g, 'o')       // pr0n → pron
    .replace(/1/g, 'i')       // sh1t → shit
    .replace(/3/g, 'e')       // r3tard → retard
    .replace(/4/g, 'a')       // 4ss → ass
    .replace(/5/g, 's')       // 5hit → shit
    .replace(/\$/g, 's')      // $hit → shit
    .replace(/@/g, 'a')       // @ss → ass
    // Deduplicate repeated letters (fuuuck → fuck, shhit → shit)
    .replace(/(.)\1{2,}/g, '$1$1')  // Keep max 2 of same char
    .replace(/(.)\1/g, '$1');        // Then reduce to 1
}

// ─── Core matching ───

function matchesWordList(word: string, wordSet: Set<string>): string | null {
  const normalized = normalize(word);
  if (normalized.length < 2) return null;

  // Exact match
  if (wordSet.has(normalized)) return normalized;

  // Prefix match for stems (e.g., "masturbat" matches "masturbating")
  for (const term of wordSet) {
    if (term.length >= 4 && normalized.startsWith(term)) return term;
    if (normalized.length >= 4 && term.startsWith(normalized)) return term;
  }

  return null;
}

// ─── Main filter ───

export function filterProfanity(text: string, mode: Mode): ProfanityResult {
  if (mode === 'adult') {
    return { filtered: false, cleanText: text, matches: [] };
  }

  const matches: string[] = [];
  // Split on word boundaries, preserving separators for reconstruction
  const parts = text.split(/\b/);

  const cleanParts = parts.map(part => {
    // Skip non-word tokens (spaces, punctuation)
    if (!/[a-zA-Z0-9àáâăäåæçèéêëìíîïðñòóôõöøùúûüýþÿșțĂÎÂȘȚ]{2,}/i.test(part)) {
      return part;
    }

    const engMatch = matchesWordList(part, ENGLISH_PROFANITY);
    const roMatch = matchesWordList(part, ROMANIAN_PROFANITY);
    const match = engMatch || roMatch;

    if (match) {
      matches.push(match);
      if (mode === 'child') {
        // Replace with asterisks of same length
        return '*'.repeat(part.length);
      }
      // Teen mode: flag but don't modify
      return part;
    }

    return part;
  });

  return {
    filtered: matches.length > 0,
    cleanText: mode === 'child' ? cleanParts.join('') : text,
    matches,
  };
}
