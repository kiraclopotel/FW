// FeelingWise - Processing Pipeline Orchestrator
// Single-call detection + neutralization for minimal latency.
//
// CARDINAL RULE: When in doubt, PASS. Ambiguous = non-intervention.

import { PostContent } from '../types/post';
import { TechniqueResult } from '../types/analysis';
import { NeutralizedContent } from '../types/neutralization';
import { detect } from './detector';
import { combinedDetectAndNeutralize } from './neutralizer';
import { getSettings } from '../storage/settings';
import { getAuthorProfile, getSuspicionBoost } from '../forensics/author-store';
import { processingCache } from '../storage/cache';
import { sha256 } from '../forensics/hasher';
import { getLastCallMeta } from '../ai/client';
import { getEffectiveThreshold } from './calibration';

export interface PipelineResult {
  action: 'pass' | 'neutralize' | 'flag';
  neutralized?: NeutralizedContent;
  aiMeta?: { model: string; provider: string };
  detectionMode?: string;
}

const PASS: PipelineResult = { action: 'pass' };

// Minimum text length to warrant AI analysis
const MIN_TEXT_LENGTH = 30;

// Romanian detection heuristic
const ROMANIAN_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;
const ROMANIAN_WORDS = /\b(și|sau|că|nu|este|sunt|pentru|care|din|cu)\b/i;

function isRomanian(text: string): boolean {
  return ROMANIAN_DIACRITICS.test(text) || ROMANIAN_WORDS.test(text);
}

// Check if text has actual prose content (not just links, handles, emojis)
function isSubstantiveText(text: string): boolean {
  // Strip URLs, @mentions, hashtags
  const stripped = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .trim();
  // Must have enough actual words remaining
  const words = stripped.split(/\s+/).filter(w => w.replace(/[^\w]/g, '').length > 1);
  return words.length >= 4 && stripped.length >= MIN_TEXT_LENGTH;
}

export async function process(post: PostContent): Promise<PipelineResult> {
  try {
    const startTime = performance.now();

    // Quick reject: too short or no real content
    if (post.text.length < MIN_TEXT_LENGTH || !isSubstantiveText(post.text)) {
      return PASS;
    }

    // Check dedup cache — identical content (retweets, reposts) gets cached result
    const textHash = await sha256(post.text);
    const cached = processingCache.get(textHash);
    if (cached) {
      console.log(`[FeelingWise] Pipeline: CACHE HIT for ${post.id}`);
      if (!cached.analysis.isManipulative || !cached.neutralizedText) {
        return PASS;
      }
      const settings = await getSettings();
      const cachedNeutralized: NeutralizedContent = {
        postId: post.id,
        originalHash: textHash,
        rewrittenText: cached.neutralizedText,
        analysis: { ...cached.analysis, postId: post.id },
        aiSource: 'cloud',
        processingTimeMs: 0,
      };
      return {
        action: settings.mode === 'adult' ? 'flag' : 'neutralize',
        neutralized: cachedNeutralized,
      };
    }

    // Cache settings once — used for budget check and mode threshold below
    const settings = await getSettings();

    // Step 1: Layer 1 — regex-based detection (fast, <5ms)
    const techniques: TechniqueResult[] = detect(post.text, post.author, post.platform);
    const detected = techniques.filter(t => t.present);
    const romanian = isRomanian(post.text);

    // Author intelligence: boost confidence for repeat offenders
    let authorBoost = 0;
    if (post.author) {
      try {
        const authorProfile = await getAuthorProfile(post.author);
        authorBoost = getSuspicionBoost(authorProfile);
        if (authorBoost > 0) {
          // Apply boost to L1 confidence caps for this author's posts
          for (const t of techniques) {
            if (t.present) {
              t.confidence = Math.min(1, t.confidence + authorBoost);
            }
          }
        }
      } catch {
        // Non-critical: author intelligence unavailable
      }
    }

    console.log(`[FeelingWise] Pipeline L1:`, {
      postId: post.id,
      detected: detected.length,
      romanian,
      authorBoost,
    });

    // Step 2: Check budget before calling AI
    if (settings.dailyCap > 0 && settings.totalChecksToday >= settings.dailyCap) {
      console.log(`[FeelingWise] Pipeline: PASS (daily cap reached)`);
      return PASS;
    }

    // Step 4: SINGLE AI CALL — detect + neutralize combined
    // This eliminates the second API round-trip, cutting latency ~50%
    const result = await combinedDetectAndNeutralize(post.text, techniques, romanian);
    const aiMeta = getLastCallMeta() ?? undefined;

    if (!result) {
      console.log(`[FeelingWise] Pipeline: PASS (AI call failed)`);
      return PASS;
    }

    const { analysis, neutralized } = result;
    analysis.postId = post.id;

    console.log(`[FeelingWise] Pipeline AI result:`, {
      postId: post.id,
      overallConfidence: analysis.overallConfidence,
      isManipulative: analysis.isManipulative,
      confirmedTechniques: analysis.techniques.filter(t => t.present).map(t => t.technique),
      hasNeutralization: !!neutralized,
    });

    // If AI says not manipulative → PASS
    if (!analysis.isManipulative) {
      console.log(`[FeelingWise] Pipeline: PASS (AI: not manipulative)`);
      return PASS;
    }

    // Step 5: Apply mode-aware confidence thresholds
    // LOWERED thresholds: borderline cases are teaching moments, especially for teens
    // Teen mode: 0.40 — the whole point is education. A teen seeing analysis of
    //   a borderline post ("was that really manipulative?") IS the learning experience.
    // Child mode: 0.45 — slightly higher bar since rewrites happen silently
    // Adult mode: 0.35 — just flagging, very low cost of false positive
    const threshold = await getEffectiveThreshold(settings.mode);

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

    // If we have a neutralized version, use it
    if (!neutralized) {
      console.log(`[FeelingWise] Pipeline: PASS (no valid neutralization produced)`);
      return PASS;
    }

    // Set the postId on the neutralized content
    neutralized.postId = post.id;
    neutralized.analysis = analysis;

    // Cache the result for dedup
    processingCache.set(textHash, analysis, neutralized.rewrittenText);

    const totalMs = performance.now() - startTime;

    // Adult mode: flag only (show indicator, don't replace text)
    if (settings.mode === 'adult') {
      console.log(`[FeelingWise] Pipeline: FLAG (${totalMs.toFixed(0)}ms)`);
      return { action: 'flag', neutralized, aiMeta, detectionMode: 'combined-detect-neutralize' };
    }

    console.log(`[FeelingWise] Pipeline: NEUTRALIZE (${totalMs.toFixed(0)}ms)`);
    return { action: 'neutralize', neutralized, aiMeta, detectionMode: 'combined-detect-neutralize' };
  } catch (err) {
    // CARDINAL RULE: any exception → PASS
    console.error('[FeelingWise] Pipeline error:', err);
    return PASS;
  }
}
