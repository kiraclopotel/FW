// FeelingWise - AI Router
//
// Decides local vs cloud based on Layer 2 analysis confidence.

import { AnalysisResult } from '../types/analysis';
import { RouterDecision } from '../types/ai';
import { LAYER3_DETECTION_SYSTEM } from './prompts';
import { callAI } from './client';

const CLOUD_TIMEOUT_MS = 5000;

export function route(analysis: AnalysisResult, cloudEnabled: boolean): RouterDecision {
  if (!cloudEnabled) {
    return { useCloud: false, reason: 'cloud disabled', confidence: analysis.overallConfidence };
  }

  if (analysis.overallConfidence > 0.85) {
    return { useCloud: false, reason: 'high confidence', confidence: analysis.overallConfidence };
  }

  if (analysis.overallConfidence < 0.60) {
    return { useCloud: true, reason: 'low confidence', confidence: analysis.overallConfidence };
  }

  const presentCount = analysis.techniques.filter(t => t.present).length;
  if (presentCount >= 3) {
    return { useCloud: true, reason: 'complex attack', confidence: analysis.overallConfidence };
  }

  return { useCloud: false, reason: 'default local', confidence: analysis.overallConfidence };
}

export async function callCloud(
  text: string,
  flags: string,
): Promise<string> {
  try {
    const userPrompt = `POST: ${text}\n\nFLAGGED: ${flags}\n\nANALYZE:`;

    const result = await Promise.race([
      callAI(LAYER3_DETECTION_SYSTEM, userPrompt, false),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Cloud timeout')), CLOUD_TIMEOUT_MS)
      ),
    ]);

    return result;
  } catch {
    console.warn('[FeelingWise] Cloud call failed or timed out, falling back to local');
    return '';
  }
}
