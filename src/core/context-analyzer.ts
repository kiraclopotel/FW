// FeelingWise - Layer 2: Local AI Semantic Verification

import { TechniqueResult, AnalysisResult } from '../types/analysis';
import { LAYER2_VERIFICATION_SYSTEM, LAYER2_VERIFICATION_USER_TEMPLATE, LAYER2_ROMANIAN_USER_TEMPLATE } from '../ai/prompts';
import { runInference } from '../ai/local/inference';

interface VerificationVerdict {
  name: string;
  verdict: 'CONFIRMED' | 'DENIED' | 'UNCERTAIN';
  severity: number;
  reason: string;
}

interface VerificationResponse {
  techniques: VerificationVerdict[];
  overallManipulative: boolean;
  overallConfidence: number;
}

function buildFlags(techniques: TechniqueResult[]): string {
  const present = techniques.filter(t => t.present);
  if (present.length === 0) return 'none';
  return present.map(t => `${t.technique} (confidence: ${t.confidence}, severity: ${t.severity})`).join(', ');
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
}

function capConfidence(techniques: TechniqueResult[], cap: number): AnalysisResult {
  const capped = techniques.map(t => ({
    ...t,
    confidence: Math.min(t.confidence, cap),
  }));
  const present = capped.filter(t => t.present);
  return {
    postId: '',
    techniques: capped,
    overallScore: present.reduce((sum, t) => sum + t.severity, 0),
    overallConfidence: present.length > 0 ? Math.min(Math.max(...present.map(t => t.confidence)), cap) : 0,
    isManipulative: present.length > 0,
    processingTimeMs: 0,
  };
}

export async function verifyWithContext(
  text: string,
  techniques: TechniqueResult[],
  isRomanian = false,
): Promise<AnalysisResult> {
  const startTime = performance.now();

  try {
    let userPrompt: string;
    if (isRomanian && techniques.filter(t => t.present).length === 0) {
      userPrompt = LAYER2_ROMANIAN_USER_TEMPLATE
        .replace('{text}', text);
    } else {
      const flags = buildFlags(techniques);
      userPrompt = LAYER2_VERIFICATION_USER_TEMPLATE
        .replace('{text}', text)
        .replace('{flags}', flags);
    }

    const raw = await runInference(LAYER2_VERIFICATION_SYSTEM, userPrompt);
    if (!raw) {
      return capConfidence(techniques, 0.60);
    }

    const cleaned = stripMarkdownFences(raw);
    // Replace single quotes with double quotes for JSON parsing
    const jsonStr = cleaned.replace(/'/g, '"');
    const response: VerificationResponse = JSON.parse(jsonStr);

    // Map verdicts onto techniques
    const verified = techniques.map(t => {
      const verdict = response.techniques?.find(
        v => v.name === t.technique
      );
      if (!verdict) return t;

      switch (verdict.verdict) {
        case 'CONFIRMED':
          return {
            ...t,
            present: true,
            confidence: Math.max(t.confidence, 0.75),
            severity: verdict.severity ?? t.severity,
          };
        case 'DENIED':
          return { ...t, present: false, confidence: 0 };
        case 'UNCERTAIN':
          return {
            ...t,
            severity: Math.max(1, t.severity - 1),
          };
        default:
          return t;
      }
    });

    const present = verified.filter(t => t.present);
    const processingTimeMs = performance.now() - startTime;

    return {
      postId: '',
      techniques: verified,
      overallScore: present.reduce((sum, t) => sum + t.severity, 0),
      overallConfidence: response.overallConfidence ?? (present.length > 0 ? Math.max(...present.map(t => t.confidence)) : 0),
      isManipulative: response.overallManipulative ?? present.length > 0,
      processingTimeMs,
    };
  } catch (err) {
    console.warn('[FeelingWise] Layer 2 parse/inference error:', err);
    return capConfidence(techniques, 0.60);
  }
}
