import { PlatformCapability, PLATFORM_CAPABILITIES } from './platform-capabilities';
import { Platform } from '../types/post';
import { Mode } from '../types/mode';

/**
 * Intervention tiers ordered by invasiveness (least → most).
 * Research evidence supporting each tier noted in comments.
 *
 * DESIGN PRINCIPLE: Never fully hide content. Maximum intervention
 * is visual dimming. Research shows hard-blocking triggers
 * circumvention in ages 9-22 (Bushman & Cantor meta-analysis).
 */
export type InterventionTier =
  | 'none'                    // No manipulation detected
  | 'hide-metrics'            // Tier 1: Hide engagement numbers (fMRI evidence: Sherman 2016)
  | 'collapse-comments'       // Tier 2: Collapse comment section (Walther 2010)
  | 'flag-container'          // Tier 3: Badge/overlay on content (educational)
  | 'dim-content'             // Tier 4: Reduce opacity to 30% (max intervention, child only)
  | 'neutralize-text';        // Text platforms: rewrite manipulative text (existing behavior)

export interface InterventionDecision {
  tier: InterventionTier;
  actions: InterventionTier[];  // May combine multiple tiers
  confidence: number;           // 0-1, based on signal quality
  reason: string;               // Human-readable explanation
  signalSources: string[];      // Which signals contributed
}

/**
 * Minimum requirements before acting on comment analysis.
 * Based on SIGIR 2011: accuracy jumps significantly at ≥10 comments.
 */
const MIN_COMMENTS_FOR_ACTION = 10;

/**
 * Multi-source convergence threshold.
 * Require at least 2 independent signal sources agreeing before video-level action.
 * This prevents miscorrection risk (UK/DE/IT preregistered studies).
 */
const MIN_SOURCES_FOR_VIDEO_ACTION = 2;

export interface VideoEnvironmentSignals {
  titleScore: number;          // 0-1 manipulation confidence from title
  descriptionScore: number;    // 0-1 from description
  commentScores: number[];     // Per-comment manipulation scores
  commentCount: number;        // Total comments available
  commentRelevance: number;    // 0-1 how relevant comments are to content
  subtitleScore: number;       // 0-1 from auto-subtitles (YouTube only, -1 if unavailable)
  authorFlagRate: number;      // Historical flag rate for this author
  authorPostCount: number;     // How many posts we've seen from this author
}

/**
 * Decide intervention based on platform capabilities, user mode, and signal quality.
 *
 * For text-first platforms: uses existing neutralize/flag logic.
 * For video-first platforms: graduated intervention based on signal convergence.
 */
export function decideIntervention(
  platform: Platform,
  mode: Mode,
  textManipulationDetected: boolean,
  videoSignals: VideoEnvironmentSignals | null,
): InterventionDecision {
  const cap = PLATFORM_CAPABILITIES[platform];

  // TEXT-FIRST PLATFORMS: use existing behavior
  if (cap.primaryContentIsText) {
    if (!textManipulationDetected) {
      return { tier: 'none', actions: ['none'], confidence: 1, reason: 'No manipulation detected', signalSources: [] };
    }
    switch (mode) {
      case 'child':
      case 'teen':
        return {
          tier: 'neutralize-text',
          actions: ['neutralize-text'],
          confidence: 0.8,
          reason: 'Text manipulation detected — neutralizing',
          signalSources: ['text-content'],
        };
      case 'adult':
        return {
          tier: 'flag-container',
          actions: ['flag-container'],
          confidence: 0.8,
          reason: 'Text manipulation detected — flagged for review',
          signalSources: ['text-content'],
        };
    }
  }

  // VIDEO-FIRST PLATFORMS: graduated intervention
  if (!videoSignals) {
    return { tier: 'none', actions: ['none'], confidence: 0, reason: 'No video environment signals available', signalSources: [] };
  }

  const { titleScore, descriptionScore, commentScores, commentCount, commentRelevance, subtitleScore, authorFlagRate, authorPostCount } = videoSignals;

  // Count converging signal sources
  const sources: string[] = [];
  let compositeScore = 0;
  let sourceCount = 0;

  // Title signal (always available)
  if (titleScore > 0.5) {
    sources.push('title');
    compositeScore += titleScore * 0.25;  // 25% weight
    sourceCount++;
  }

  // Description signal
  if (descriptionScore > 0.5) {
    sources.push('description');
    compositeScore += descriptionScore * 0.15;  // 15% weight
    sourceCount++;
  }

  // Comment signal (ONLY if ≥10 comments AND relevance > 0.6)
  if (commentCount >= MIN_COMMENTS_FOR_ACTION && commentRelevance > 0.6) {
    const avgCommentScore = commentScores.length > 0
      ? commentScores.reduce((a, b) => a + b, 0) / commentScores.length
      : 0;
    const flaggedCommentRatio = commentScores.filter(s => s > 0.5).length / Math.max(commentScores.length, 1);
    if (avgCommentScore > 0.4 || flaggedCommentRatio > 0.3) {
      sources.push('comments');
      compositeScore += Math.max(avgCommentScore, flaggedCommentRatio) * 0.30;  // 30% weight
      sourceCount++;
    }
  }

  // Subtitle signal (YouTube only)
  if (subtitleScore >= 0 && subtitleScore > 0.5) {
    sources.push('subtitles');
    compositeScore += subtitleScore * 0.15;  // 15% weight
    sourceCount++;
  }

  // Author history signal (only if we have enough data)
  if (authorPostCount >= 5 && authorFlagRate > 0.5) {
    sources.push('author-history');
    compositeScore += authorFlagRate * 0.15;  // 15% weight
    sourceCount++;
  }

  // Normalize composite score
  const confidence = sourceCount > 0 ? Math.min(compositeScore * (1 + sourceCount * 0.1), 1) : 0;

  // DECISION LOGIC per mode
  const actions: InterventionTier[] = [];

  if (mode === 'child') {
    // Tier 1: ALWAYS hide metrics on video platforms in child mode
    // (strongest evidence base, zero false positive risk)
    if (cap.canHideMetrics) {
      actions.push('hide-metrics');
    }

    // Tier 2: Collapse comments by default in child mode
    // (reduces amplification — Walther 2010)
    if (cap.canCollapseComments) {
      actions.push('collapse-comments');
    }

    // Tier 3+4: Only with multi-source convergence
    if (sourceCount >= MIN_SOURCES_FOR_VIDEO_ACTION && confidence > 0.6) {
      actions.push('flag-container');
    }
    if (sourceCount >= MIN_SOURCES_FOR_VIDEO_ACTION && confidence > 0.85) {
      actions.push('dim-content');
    }
  }

  if (mode === 'teen') {
    // Tier 1: Hide metrics (configurable — teen may want to see them)
    // Default: hidden. Teen can toggle in settings.
    if (cap.canHideMetrics) {
      actions.push('hide-metrics');
    }

    // Tier 2: Collapse comments only if flagged comments detected
    if (cap.canCollapseComments && commentScores.filter(s => s > 0.5).length >= 2) {
      actions.push('collapse-comments');
    }

    // Tier 3: Flag with educational overlay
    if (sourceCount >= MIN_SOURCES_FOR_VIDEO_ACTION && confidence > 0.5) {
      actions.push('flag-container');
    }

    // Never dim in teen mode — use education, not restriction
  }

  if (mode === 'adult') {
    // Adults: flag only, never suppress
    if (sourceCount >= MIN_SOURCES_FOR_VIDEO_ACTION && confidence > 0.4) {
      actions.push('flag-container');
    }
    // No metric hiding or comment collapsing for adults unless they opt in
  }

  const tier = actions.length > 0 ? actions[actions.length - 1] : 'none';

  const reason = actions.length === 0
    ? sourceCount === 0
      ? 'No manipulation signals detected in text environment'
      : `Signal detected (${sources.join(', ')}) but below action threshold (${sourceCount} source${sourceCount === 1 ? '' : 's'}, need ${MIN_SOURCES_FOR_VIDEO_ACTION})`
    : `${actions.length} intervention${actions.length === 1 ? '' : 's'} applied based on ${sources.join(' + ')} (confidence: ${(confidence * 100).toFixed(0)}%)`;

  return { tier, actions, confidence, reason, signalSources: sources };
}
