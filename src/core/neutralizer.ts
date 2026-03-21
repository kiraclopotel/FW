// FeelingWise - Neutralization Engine

import { AnalysisResult } from '../types/analysis';
import { NeutralizedContent } from '../types/neutralization';
import { NEUTRALIZATION_SYSTEM, NEUTRALIZATION_USER_TEMPLATE } from '../ai/prompts';
import { callAI } from '../ai/client';
import { sha256 } from '../forensics/hasher';

const FORBIDDEN_PATTERN = /manipulat|propaganda|technique|fallacy|rhetoric/i;

function validateNeutralization(original: string, rewritten: string): boolean {
  if (rewritten.length > original.length * 1.2) return false;
  if (rewritten.length < 5) return false;
  if (FORBIDDEN_PATTERN.test(rewritten)) return false;
  return true;
}

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
      console.warn('[FeelingWise] Neutralization failed validation');
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
