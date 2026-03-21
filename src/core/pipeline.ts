// FeelingWise - Processing Pipeline Orchestrator
// Three-layer detection cascade: Pattern Scan -> AI Verification -> Deep Scan (optional)
//
// CARDINAL RULE: When in doubt, PASS. Ambiguous = non-intervention.

import { PostContent } from '../types/post';
import { TechniqueResult } from '../types/analysis';
import { NeutralizedContent } from '../types/neutralization';
import { detect } from './detector';
import { verifyWithContext } from './context-analyzer';
import { neutralize } from './neutralizer';
import { getSettings } from '../storage/settings';
import { scoreSuspicion, shouldSample } from './suspicion';

export interface PipelineResult {
  action: 'pass' | 'neutralize' | 'flag';
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

    // If zero triggers and not Romanian → check suspicion heuristics for sampling
    let wasSampled = false;
    if (detected.length === 0 && !romanian) {
      const settings = await getSettings();
      const suspicion = scoreSuspicion(post.text);

      if (!shouldSample(suspicion.total, settings.totalChecksToday, settings.dailyCap)) {
        console.log(`[FeelingWise] Pipeline: PASS (no triggers, suspicion ${suspicion.total.toFixed(2)}, not sampled)`);
        return PASS;
      }

      console.log(`[FeelingWise] Pipeline: SAMPLED (suspicion ${suspicion.total.toFixed(2)})`);
      wasSampled = true;
      // Fall through to Layer 2 with empty technique list
      // L2 AI will do full analysis from scratch
    }

    // Step 2: Layer 2 — AI verification via callAI()
    const settings = await getSettings();
    const fastMode = !settings.deepScanEnabled;
    const analysis = await verifyWithContext(post.text, techniques, romanian, fastMode, wasSampled);
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

    // Step 3: Apply mode-aware confidence thresholds
    // Child/teen: threshold for NEUTRALIZATION (replacing content)
    // Adult: threshold for FLAGGING (showing amber dot — original stays)
    const threshold = settings.mode === 'child' ? 0.65
                    : settings.mode === 'teen' ? 0.60
                    : 0.55; // adult: just flagging, low cost of false positive

    if (analysis.overallConfidence < threshold) {
      console.log(`[FeelingWise] Pipeline: PASS (confidence ${analysis.overallConfidence.toFixed(2)} < threshold ${threshold})`);
      return PASS;
    }

    // Reduce severity for borderline detections
    if (analysis.overallConfidence < threshold + 0.10) {
      for (const t of analysis.techniques) {
        if (t.present) {
          t.severity = Math.max(1, t.severity - 1);
        }
      }
    }

    // Step 4: Neutralize
    const neutralized = await neutralize(post.text, analysis);

    if (!neutralized) {
      console.log(`[FeelingWise] Pipeline: PASS (neutralization failed/invalid)`);
      return PASS;
    }

    const totalMs = performance.now() - startTime;

    // Adult mode: flag only (show indicator, don't replace text)
    if (settings.mode === 'adult') {
      console.log(`[FeelingWise] Pipeline: FLAG (${totalMs.toFixed(0)}ms)`);
      return { action: 'flag', neutralized };
    }

    console.log(`[FeelingWise] Pipeline: NEUTRALIZE (${totalMs.toFixed(0)}ms)`);
    return { action: 'neutralize', neutralized };
  } catch (err) {
    // CARDINAL RULE: any exception → PASS
    console.error('[FeelingWise] Pipeline error:', err);
    return PASS;
  }
}
