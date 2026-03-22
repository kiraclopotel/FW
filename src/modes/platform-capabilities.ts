// FeelingWise - Platform capability matrix
// Defines what FeelingWise CAN and CANNOT do on each platform.
// The injector and pipeline use this to decide behavior.

import { Platform } from '../types/post';
import { Mode } from '../types/mode';

export interface PlatformCapability {
  // Can we rewrite text content? (tweets, reddit posts, 4chan posts)
  canNeutralizeText: boolean;
  // Can we suppress/collapse the comments section?
  canSuppressComments: boolean;
  // Can we flag/hide video containers based on text proxy signals?
  canFlagVideo: boolean;
  // Are auto-generated subtitles/transcripts available in the DOM?
  hasSubtitles: boolean;
  // Is the primary content text (vs video/image)?
  primaryContentIsText: boolean;
}

export const PLATFORM_CAPABILITIES: Record<Platform, PlatformCapability> = {
  twitter:   { canNeutralizeText: true,  canSuppressComments: false, canFlagVideo: false, hasSubtitles: false, primaryContentIsText: true  },
  facebook:  { canNeutralizeText: true,  canSuppressComments: true,  canFlagVideo: true,  hasSubtitles: false, primaryContentIsText: true  },
  youtube:   { canNeutralizeText: true,  canSuppressComments: true,  canFlagVideo: true,  hasSubtitles: true,  primaryContentIsText: false },
  tiktok:    { canNeutralizeText: false, canSuppressComments: true,  canFlagVideo: true,  hasSubtitles: false, primaryContentIsText: false },
  instagram: { canNeutralizeText: false, canSuppressComments: true,  canFlagVideo: true,  hasSubtitles: false, primaryContentIsText: false },
  reddit:    { canNeutralizeText: true,  canSuppressComments: false, canFlagVideo: false, hasSubtitles: false, primaryContentIsText: true  },
  '4chan':    { canNeutralizeText: true,  canSuppressComments: false, canFlagVideo: false, hasSubtitles: false, primaryContentIsText: true  },
};

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
      if (cap.canSuppressComments && manipulativeCommentCount >= 2) return 'suppress-comments';
      if (cap.canFlagVideo && hasManipulativeText) return 'flag-video';
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
