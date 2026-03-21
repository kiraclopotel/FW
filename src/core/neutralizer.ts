// FeelingWise - Neutralization Engine
// Now supports combined detect+neutralize in a single AI call for speed.

import { TechniqueResult, AnalysisResult } from '../types/analysis';
import { NeutralizedContent } from '../types/neutralization';
import {
  NEUTRALIZATION_SYSTEM,
  NEUTRALIZATION_USER_TEMPLATE,
  COMBINED_DETECT_NEUTRALIZE_SYSTEM,
  COMBINED_DETECT_NEUTRALIZE_USER_TEMPLATE,
  COMBINED_DETECT_NEUTRALIZE_USER_TEMPLATE_NOFLAG,
} from '../ai/prompts';
import { callAI } from '../ai/client';
import { sha256 } from '../forensics/hasher';

// Relaxed forbidden words: only reject if the rewrite contains meta-commentary
// about manipulation techniques (the AI explaining itself instead of rewriting).
// Single-word matches like "rhetoric" in normal prose are fine — we check for
// phrases that indicate the AI broke character and started editorializing.
const FORBIDDEN_META_PATTERNS = [
  /\bthis (?:post |text |content )?(?:uses?|contains?|employs?|exhibits?|demonstrates?) .{0,30}(?:manipulat|propaganda|technique|fallacy)/i,
  /\bmanipulation technique/i,
  /\bpropaganda (?:technique|tactic|method)/i,
  /\bnote:?\s/i,
  /\bwarning:?\s/i,
  /\beditor'?s note/i,
  /\b\[.*manipulat.*\]/i,
];

function validateNeutralization(original: string, rewritten: string): boolean {
  // Minimum length check
  if (rewritten.length < 5) return false;

  // Length check: short manipulative posts use dense shorthand that needs
  // more words to express neutrally, so we allow generous ratios for short text.
  const maxRatio = original.length < 100 ? 3.0
                 : original.length < 280 ? 2.0
                 : original.length < 500 ? 1.8
                 : 1.5;
  if (rewritten.length > original.length * maxRatio) return false;

  // Check for meta-commentary (AI breaking character)
  for (const pattern of FORBIDDEN_META_PATTERNS) {
    if (pattern.test(rewritten)) return false;
  }

  return true;
}

interface CombinedResponse {
  techniques: Array<{
    name: string;
    verdict: string;
    severity: number;
    reason: string;
  }>;
  overallManipulative: boolean;
  overallConfidence: number;
  neutralizedText: string | null;
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
}

function extractCombinedJSON(raw: string): CombinedResponse | null {
  const cleaned = stripMarkdownFences(raw);

  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* continue */ }
  }

  // Fix single quotes
  try {
    const fixed = cleaned
      .replace(/(\{|\[|,)\s*'/g, '$1"')
      .replace(/'\s*(:|\}|\]|,)/g, '"$1');
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}

/**
 * Combined detect + neutralize in a SINGLE API call.
 * Returns both the analysis result and neutralized content (if manipulative).
 * This halves latency compared to two sequential calls.
 */
export async function combinedDetectAndNeutralize(
  text: string,
  techniques: TechniqueResult[],
  isRomanian: boolean,
): Promise<{ analysis: AnalysisResult; neutralized: NeutralizedContent | null } | null> {
  try {
    const startTime = performance.now();
    const detected = techniques.filter(t => t.present);

    // Build user prompt
    let userPrompt: string;
    if (detected.length > 0) {
      const flags = detected
        .map(t => `${t.technique} (confidence: ${t.confidence}, severity: ${t.severity})`)
        .join(', ');
      userPrompt = COMBINED_DETECT_NEUTRALIZE_USER_TEMPLATE
        .replace('{text}', text)
        .replace('{flags}', flags);
    } else {
      userPrompt = COMBINED_DETECT_NEUTRALIZE_USER_TEMPLATE_NOFLAG
        .replace('{text}', text);
    }

    const raw = await callAI(COMBINED_DETECT_NEUTRALIZE_SYSTEM, userPrompt, true);
    if (!raw) return null;

    const response = extractCombinedJSON(raw);
    if (!response) {
      console.warn('[FeelingWise] Combined response parse failed');
      return null;
    }

    const processingTimeMs = performance.now() - startTime;

    // Build analysis result
    const verified: TechniqueResult[] = techniques.map(t => {
      const aiTechnique = response.techniques?.find(at => at.name === t.technique);
      if (!aiTechnique) return { ...t, present: false, confidence: 0 };
      if (aiTechnique.verdict === 'CONFIRMED') {
        return {
          ...t,
          present: true,
          confidence: response.overallConfidence ?? 0.75,
          severity: aiTechnique.severity ?? 5,
          evidence: [aiTechnique.reason ?? ''],
        };
      }
      return { ...t, present: false, confidence: 0 };
    });

    // Also add any techniques the AI found that weren't in L1
    if (response.techniques) {
      for (const aiT of response.techniques) {
        if (aiT.verdict !== 'CONFIRMED') continue;
        const exists = verified.some(t => t.technique === aiT.name);
        if (!exists) {
          verified.push({
            technique: aiT.name as TechniqueResult['technique'],
            present: true,
            confidence: response.overallConfidence ?? 0.75,
            severity: aiT.severity ?? 5,
            evidence: [aiT.reason ?? ''],
          });
        }
      }
    }

    const present = verified.filter(t => t.present);
    const analysis: AnalysisResult = {
      postId: '',
      techniques: verified,
      overallScore: present.reduce((sum, t) => sum + t.severity, 0),
      overallConfidence: response.overallConfidence ?? (present.length > 0 ? Math.max(...present.map(t => t.confidence)) : 0),
      isManipulative: response.overallManipulative ?? present.length > 0,
      processingTimeMs,
    };

    // Build neutralization if AI provided it and post is manipulative
    let neutralized: NeutralizedContent | null = null;
    if (analysis.isManipulative && response.neutralizedText) {
      const trimmed = response.neutralizedText.trim();
      if (validateNeutralization(text, trimmed)) {
        neutralized = {
          postId: '',
          originalHash: await sha256(text),
          rewrittenText: trimmed,
          analysis,
          aiSource: 'cloud',
          processingTimeMs,
        };
      } else {
        console.warn('[FeelingWise] Combined neutralization failed validation, length ratio:',
          (trimmed.length / text.length).toFixed(2),
          'text:', trimmed.substring(0, 80) + '...');
      }
    }

    return { analysis, neutralized };
  } catch (err) {
    console.error('[FeelingWise] Combined detect+neutralize error:', err);
    return null;
  }
}

/**
 * Standalone neutralization (fallback, used if combined call wasn't used).
 */
export async function neutralize(
  text: string,
  analysis: AnalysisResult,
): Promise<NeutralizedContent | null> {
  try {
    const presentTechniques = analysis.techniques
      .filter(t => t.present)
      .map(t => t.technique)
      .join(', ');

    const userPrompt = NEUTRALIZATION_USER_TEMPLATE
      .replace('{text}', text)
      .replace('{techniques}', presentTechniques);

    const startTime = performance.now();
    const rewritten = await callAI(NEUTRALIZATION_SYSTEM, userPrompt, true);

    if (!rewritten) return null;

    const trimmed = rewritten.trim();

    if (!validateNeutralization(text, trimmed)) {
      console.warn('[FeelingWise] Neutralization failed validation, length ratio:',
        (trimmed.length / text.length).toFixed(2));
      return null;
    }

    return {
      postId: analysis.postId,
      originalHash: await sha256(text),
      rewrittenText: trimmed,
      analysis,
      aiSource: 'cloud',
      processingTimeMs: performance.now() - startTime,
    };
  } catch (err) {
    console.error('[FeelingWise] Neutralization error:', err);
    return null;
  }
}
