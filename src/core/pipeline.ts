// FeelingWise - Processing Pipeline Orchestrator
// Three-layer detection cascade: Pattern Scan -> AI Verification -> Cloud (optional)
//
// CARDINAL RULE: When in doubt, PASS. Ambiguous = non-intervention.

import { PostContent } from '../types/post';
import { TechniqueResult } from '../types/analysis';
import { NeutralizedContent } from '../types/neutralization';
import { detect } from './detector';
import { verifyWithContext } from './context-analyzer';
import { neutralize } from './neutralizer';
import { route, callCloud } from '../ai/router';
import { getSettings } from '../storage/settings';

export interface PipelineResult {
  action: 'pass' | 'neutralize';
  neutralized?: NeutralizedContent;
}

const PASS: PipelineResult = { action: 'pass' };

// Romanian detection heuristic
const ROMANIAN_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;
const ROMANIAN_WORDS = /\b(și|sau|că|nu|este|sunt|pentru|care|din|cu)\b/i;

function isRomanian(text: string): boolean {
  return ROMANIAN_DIACRITICS.test(text) || ROMANIAN_WORDS.test(text);
}

export async function process(post: PostContent): Promise<PipelineResult> {
  try {
    const startTime = performance.now();

    // Step 1: Layer 1 — regex-based detection
    const techniques: TechniqueResult[] = detect(post.text, post.author, post.platform);
    const detected = techniques.filter(t => t.present);
    const romanian = isRomanian(post.text);

    console.log(`[FeelingWise] Pipeline L1:`, {
      postId: post.id,
      detected: detected.length,
      romanian,
    });

    // If zero triggers and not Romanian → PASS
    if (detected.length === 0 && !romanian) {
      console.log(`[FeelingWise] Pipeline: PASS (no triggers)`);
      return PASS;
    }

    // Step 2: Layer 2 — AI verification (via message passing to service worker)
    // If model isn't ready, verifyWithContext returns capped L1 results (inference returns '')
    const analysis = await verifyWithContext(post.text, techniques, romanian);
    analysis.postId = post.id;

    console.log(`[FeelingWise] Pipeline L2:`, {
      postId: post.id,
      overallConfidence: analysis.overallConfidence,
      isManipulative: analysis.isManipulative,
      confirmedTechniques: analysis.techniques.filter(t => t.present).map(t => t.technique),
    });

    // If Layer 2 says not manipulative → PASS
    if (!analysis.isManipulative) {
      console.log(`[FeelingWise] Pipeline: PASS (L2 not manipulative)`);
      return PASS;
    }

    // Step 3: Apply confidence thresholds
    const settings = await getSettings();
    let shouldNeutralize = false;

    if (analysis.overallConfidence > 0.85) {
      shouldNeutralize = true;
    } else if (analysis.overallConfidence >= 0.60) {
      // Proceed with severity reduced by 1
      for (const t of analysis.techniques) {
        if (t.present) {
          t.severity = Math.max(1, t.severity - 1);
        }
      }
      shouldNeutralize = true;
    } else {
      // Low confidence — check router
      const decision = route(analysis, settings.cloudEnabled);
      console.log(`[FeelingWise] Router:`, decision);

      if (decision.useCloud) {
        // Layer 3: Cloud verification (stub — returns '' for now)
        const flags = analysis.techniques
          .filter(t => t.present)
          .map(t => t.technique)
          .join(', ');
        const cloudResult = await callCloud(post.text, flags);

        if (!cloudResult) {
          // Cloud returned nothing (stub or timeout) → PASS
          console.log(`[FeelingWise] Pipeline: PASS (cloud empty/timeout)`);
          return PASS;
        }
        // If cloud returns a result, we'd parse it here (Phase 7)
        shouldNeutralize = true;
      } else {
        console.log(`[FeelingWise] Pipeline: PASS (low confidence, no cloud)`);
        return PASS;
      }
    }

    if (!shouldNeutralize) {
      return PASS;
    }

    // Step 4: Neutralize
    const neutralized = await neutralize(post.text, analysis);

    if (!neutralized) {
      console.log(`[FeelingWise] Pipeline: PASS (neutralization failed/invalid)`);
      return PASS;
    }

    const totalMs = performance.now() - startTime;
    console.log(`[FeelingWise] Pipeline: NEUTRALIZE (${totalMs.toFixed(0)}ms)`);

    return { action: 'neutralize', neutralized };
  } catch (err) {
    // CARDINAL RULE: any exception → PASS
    console.error('[FeelingWise] Pipeline error:', err);
    return PASS;
  }
}
