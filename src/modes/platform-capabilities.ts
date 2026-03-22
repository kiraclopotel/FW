// FeelingWise - Platform capability matrix
// Defines what FeelingWise CAN and CANNOT do on each platform.
// The injector and pipeline use this to decide behavior.

import { Platform } from '../types/post';
import { Mode } from '../types/mode';

export interface PlatformCapability {
  canNeutralizeText: boolean;       // Can rewrite text content (tweets, reddit posts)
  canCollapseComments: boolean;     // Can collapse/minimize comment sections
  canHideMetrics: boolean;          // Can hide like counts, share counts, comment counts
  canFlagVideoContainer: boolean;   // Can add badges/overlays to video containers
  canExtractSubtitles: boolean;     // Auto-generated subtitles available in DOM
  primaryContentIsText: boolean;    // Primary content is text (not video/image)
  extractionStability: 'high' | 'medium' | 'low';  // How stable is DOM extraction
  commentLoadMethod: 'dom' | 'lazy' | 'api' | 'none'; // How comments are loaded
}

export const PLATFORM_CAPABILITIES: Record<Platform, PlatformCapability> = {
  twitter: {
    canNeutralizeText: true,
    canCollapseComments: false,
    canHideMetrics: false,
    canFlagVideoContainer: false,
    canExtractSubtitles: false,
    primaryContentIsText: true,
    extractionStability: 'high',
    commentLoadMethod: 'dom',
  },
  facebook: {
    canNeutralizeText: true,
    canCollapseComments: true,
    canHideMetrics: true,
    canFlagVideoContainer: true,
    canExtractSubtitles: false,
    primaryContentIsText: true,
    extractionStability: 'medium',
    commentLoadMethod: 'lazy',
  },
  youtube: {
    canNeutralizeText: true,       // Comments, descriptions
    canCollapseComments: true,
    canHideMetrics: true,          // Like count, view count, sub count
    canFlagVideoContainer: true,
    canExtractSubtitles: true,     // ytInitialPlayerResponse.captions
    primaryContentIsText: false,
    extractionStability: 'high',   // Polymer components, stable IDs
    commentLoadMethod: 'lazy',     // Continuation tokens via youtubei/v1/next
  },
  tiktok: {
    canNeutralizeText: false,      // Captions too short/integrated
    canCollapseComments: true,
    canHideMetrics: true,          // Like, comment, share counts
    canFlagVideoContainer: true,
    canExtractSubtitles: false,
    primaryContentIsText: false,
    extractionStability: 'medium', // Hydration JSON stable; CSS classes fragile
    commentLoadMethod: 'api',      // /api/comment/list/ triggered by scroll
  },
  instagram: {
    canNeutralizeText: false,
    canCollapseComments: true,
    canHideMetrics: true,
    canFlagVideoContainer: true,
    canExtractSubtitles: false,
    primaryContentIsText: false,
    extractionStability: 'low',    // Obfuscated classes rotate every deploy
    commentLoadMethod: 'lazy',
  },
  reddit: {
    canNeutralizeText: true,
    canCollapseComments: false,
    canHideMetrics: false,
    canFlagVideoContainer: false,
    canExtractSubtitles: false,
    primaryContentIsText: true,
    extractionStability: 'high',
    commentLoadMethod: 'dom',
  },
  '4chan': {
    canNeutralizeText: true,
    canCollapseComments: false,
    canHideMetrics: false,
    canFlagVideoContainer: false,
    canExtractSubtitles: false,
    primaryContentIsText: true,
    extractionStability: 'high',
    commentLoadMethod: 'dom',
  },
};

// Legacy re-exports for backward compatibility with existing pipeline
export type PlatformAction =
  | 'neutralize'        // Rewrite text (text-first platforms)
  | 'flag'              // Show indicator, don't modify (adult mode on text platforms)
  | 'suppress-comments' // Hide comments section (child mode on video platforms)
  | 'flag-video'        // Badge/overlay on video container (teen/adult on video platforms)
  | 'flag-comments'     // Show flagged comments with analysis (teen mode on video platforms)
  | 'pass';             // Do nothing

/**
 * Decide what action to take based on platform capabilities and user mode.
 * This replaces the simple mode === 'adult' ? 'flag' : 'neutralize' logic.
 */
export function decidePlatformAction(
  platform: Platform,
  mode: Mode,
  hasManipulativeText: boolean,
  manipulativeCommentCount: number,
): PlatformAction {
  const cap = PLATFORM_CAPABILITIES[platform];

  // If no manipulation detected, always pass
  if (!hasManipulativeText && manipulativeCommentCount === 0) return 'pass';

  // Text-first platforms: use existing behavior
  if (cap.primaryContentIsText) {
    if (!hasManipulativeText) return 'pass';
    switch (mode) {
      case 'child': return cap.canNeutralizeText ? 'neutralize' : 'pass';
      case 'teen':  return cap.canNeutralizeText ? 'neutralize' : 'pass';
      case 'adult': return 'flag';
    }
  }

  // Video-first platforms: different strategy per mode
  switch (mode) {
    case 'child':
      // Suppress comments entirely + flag video if text signals are severe
      if (cap.canCollapseComments && manipulativeCommentCount >= 2) return 'suppress-comments';
      if (cap.canFlagVideoContainer && hasManipulativeText) return 'flag-video';
      return 'pass';

    case 'teen':
      // Show flagged comments with analysis (learning opportunity)
      if (manipulativeCommentCount > 0) return 'flag-comments';
      if (hasManipulativeText) return 'flag-video';
      return 'pass';

    case 'adult':
      // Badge on video, analysis on demand
      if (hasManipulativeText || manipulativeCommentCount > 0) return 'flag-video';
      return 'pass';
  }
}
