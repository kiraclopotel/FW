// FeelingWise - Layer 2: AI Semantic Verification

import { TechniqueResult, AnalysisResult, TechniqueName } from '../types/analysis';
import { LAYER2_VERIFICATION_SYSTEM, LAYER2_VERIFICATION_USER_TEMPLATE, LAYER2_ROMANIAN_USER_TEMPLATE, SAMPLED_DETECTION_SYSTEM, SAMPLED_DETECTION_USER_TEMPLATE } from '../ai/prompts';
import { callAI } from '../ai/client';
import { aggregateSeverity } from './severity';

/** All technique names recognised by the downstream injector / UI. */
const VALID_TECHNIQUES: Set<string> = new Set<string>([
  'fear-appeal', 'anger-trigger', 'shame-attack', 'false-urgency',
  'bandwagon', 'scapegoating', 'fomo', 'toxic-positivity',
  'misleading-format', 'combined',
] satisfies TechniqueName[]);

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

function extractJSON(raw: string): VerificationResponse | null {
  const cleaned = stripMarkdownFences(raw);

  // Try parsing as-is first (double-quoted JSON)
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // Try extracting JSON object from surrounding text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* continue */ }
  }

  // Last resort: try fixing common AI JSON quirks
  try {
    // Replace only single quotes that are JSON structural (not inside values)
    const fixed = cleaned
      .replace(/(\{|\[|,)\s*'/g, '$1"')  // opening quotes after { [ ,
      .replace(/'\s*(:|\}|\]|,)/g, '"$1'); // closing quotes before : } ] ,
    return JSON.parse(fixed);
  } catch {
    return null;
  }
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
    overallScore: aggregateSeverity(capped),
    overallConfidence: present.length > 0 ? Math.min(Math.max(...present.map(t => t.confidence)), cap) : 0,
    isManipulative: present.length > 0,
    processingTimeMs: 0,
  };
}

export async function verifyWithContext(
  text: string,
  techniques: TechniqueResult[],
  isRomanian = false,
  fastMode = true,
  sampled = false,
): Promise<AnalysisResult> {
  const startTime = performance.now();

  try {
    let systemPrompt: string;
    let userPrompt: string;
    if (sampled || (isRomanian && techniques.filter(t => t.present).length === 0)) {
      // SAMPLED post or Romanian with no L1 flags: use DETECTION prompt (analyze from scratch)
      systemPrompt = SAMPLED_DETECTION_SYSTEM;
      userPrompt = SAMPLED_DETECTION_USER_TEMPLATE.replace('{text}', text);
    } else {
      // L1-triggered post: use VERIFICATION prompt (verify existing flags)
      systemPrompt = LAYER2_VERIFICATION_SYSTEM;
      const flags = buildFlags(techniques);
      userPrompt = LAYER2_VERIFICATION_USER_TEMPLATE
        .replace('{text}', text)
        .replace('{flags}', flags);
    }

    const raw = await callAI(systemPrompt, userPrompt, fastMode);
    if (!raw) {
      return capConfidence(techniques, 0.60);
    }

    const response = extractJSON(raw);
    if (!response) {
      return capConfidence(techniques, 0.60);
    }

    let verified: TechniqueResult[];
    if (sampled || (isRomanian && techniques.filter(t => t.present).length === 0)) {
      // For sampled/Romanian posts: BUILD technique results from AI response
      // Start with all techniques as not-present
      verified = techniques.map(t => ({ ...t, present: false, confidence: 0 }));
      // Mark techniques the AI confirmed as present
      if (response.techniques) {
        for (const aiTechnique of response.techniques) {
          if (!VALID_TECHNIQUES.has(aiTechnique.name)) continue;
          const idx = verified.findIndex(t => t.technique === aiTechnique.name);
          if (idx !== -1 && aiTechnique.verdict === 'CONFIRMED') {
            verified[idx] = {
              ...verified[idx],
              present: true,
              confidence: response.overallConfidence ?? 0.75,
              severity: aiTechnique.severity ?? 5,
              evidence: [aiTechnique.reason ?? ''],
            };
          }
        }
      }
    } else {
      // For L1-triggered posts: MAP verdicts onto existing techniques (existing behavior)
      verified = techniques.map(t => {
        const verdict = response.techniques?.find(v => v.name === t.technique);
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
            return { ...t, severity: Math.max(1, t.severity - 1) };
          default:
            return t;
        }
      });
    }

    const present = verified.filter(t => t.present);
    const processingTimeMs = performance.now() - startTime;

    return {
      postId: '',
      techniques: verified,
      overallScore: aggregateSeverity(verified),
      overallConfidence: response.overallConfidence ?? (present.length > 0 ? Math.max(...present.map(t => t.confidence)) : 0),
      isManipulative: response.overallManipulative ?? present.length > 0,
      processingTimeMs,
    };
  } catch (err) {
    console.warn('[FeelingWise] Layer 2 parse/inference error:', err);
    return capConfidence(techniques, 0.60);
  }
}
