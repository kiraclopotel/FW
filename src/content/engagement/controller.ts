// FeelingWise - Engagement control entry point
// Single controller that reads settings, decides what should happen,
// and delegates to platform-specific engagement modules.
// Handles runtime mode/settings changes with full teardown → reset → restart.

import type { Platform } from '../../types/post';
import type { Mode } from '../../types/mode';
import type { VideoControls } from '../../storage/settings';
import { getSettings } from '../../storage/settings';
import { isContextAlive } from '../context-guard';
import { startTikTokEngagementControl } from './tiktok-engagement';
import { startTwitterEngagementControl } from './twitter-engagement';

// ─── Style tag IDs (must match platform modules) ───

const STYLE_TAG_IDS = [
  'fw-tiktok-action-rail-css',
  'fw-tiktok-comment-section-css',
  'fw-tiktok-post-block-css',
  'fw-twitter-engagement-css',
];

// ─── Settings → Active Decision ───

function shouldControlEngagement(
  platform: Platform,
  mode: Mode,
  vc: VideoControls,
): boolean {
  switch (mode) {
    case 'child':
      switch (platform) {
        case 'twitter':
          return vc.childBlockActionsPlatforms.twitter || vc.childHideMetrics;
        case 'tiktok':
          return (vc.childBlockActions && vc.childBlockActionsPlatforms.tiktok)
            || vc.childHideMetrics
            || vc.childBlockPosting;
        case 'instagram':
          return vc.childBlockActionsPlatforms.instagram || vc.childHideMetrics;
        case 'facebook':
          return vc.childBlockActionsPlatforms.facebook || vc.childHideMetrics;
        default:
          return false;
      }
    case 'teen':
      return vc.teenHideMetrics;
    case 'adult':
      return vc.adultHideMetrics;
    default:
      return false;
  }
}

// ─── DOM Reset ───

function resetEngagementDOM(): void {
  // Remove all injected style tags
  for (const id of STYLE_TAG_IDS) {
    document.getElementById(id)?.remove();
  }

  // Clean action rail markers (TikTok)
  document.querySelectorAll<HTMLElement>('[data-fw-action-rail]').forEach(el => {
    delete el.dataset.fwActionRail;
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    // Restore count element visibility inside the rail
    const countSelectors = [
      '[data-e2e="like-count"]',
      '[data-e2e="comment-count"]',
      '[data-e2e="share-count"]',
      '[data-e2e="undefined-count"]',
    ];
    for (const sel of countSelectors) {
      el.querySelectorAll<HTMLElement>(sel).forEach(count => {
        count.style.removeProperty('visibility');
      });
    }
  });

  // Clean action row markers (Twitter)
  document.querySelectorAll<HTMLElement>('[data-fw-action-row]').forEach(el => {
    delete el.dataset.fwActionRow;
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('height');
    el.style.removeProperty('overflow');
    // Restore count spans inside buttons
    el.querySelectorAll<HTMLElement>('span').forEach(span => {
      span.style.removeProperty('visibility');
    });
    // Restore analytics links
    el.querySelectorAll<HTMLElement>('a[href*="/analytics"]').forEach(link => {
      link.style.removeProperty('display');
    });
  });

  // Clean comment section markers (TikTok)
  document.querySelectorAll<HTMLElement>('[data-fw-comment-section]').forEach(el => {
    delete el.dataset.fwCommentSection;
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
  });

  // Clean post-blocked markers (TikTok)
  document.querySelectorAll<HTMLElement>('[data-fw-post-blocked]').forEach(el => {
    delete el.dataset.fwPostBlocked;
    el.style.removeProperty('display');
  });
}

// ─── Platform Routing ───

function startPlatformEngagement(platform: Platform, mode: Mode, vc: VideoControls): () => void {
  switch (platform) {
    case 'tiktok':
      return startTikTokEngagementControl(mode, vc);
    case 'twitter':
      return startTwitterEngagementControl(mode, vc);
    default:
      console.log(
        `[FeelingWise] Engagement control: not yet implemented for ${platform}`,
      );
      return () => {};
  }
}

// ─── Main Entry Point ───

export async function initEngagementControl(
  platform: Platform,
): Promise<() => void> {
  if (!isContextAlive()) {
    return () => {};
  }

  const settings = await getSettings();
  let { mode } = settings;
  const { videoControls } = settings;

  let activeCleanup: () => void = () => {};

  if (shouldControlEngagement(platform, mode, videoControls)) {
    activeCleanup = startPlatformEngagement(platform, mode, videoControls);
  }

  // Listen for runtime settings changes
  const storageListener = async (
    changes: Record<string, chrome.storage.StorageChange>,
  ) => {
    if (!isContextAlive()) {
      chrome.storage.onChanged.removeListener(storageListener);
      return;
    }

    if (!changes.mode && !changes.videoControls) {
      return;
    }

    // 1. Stop current engagement control
    activeCleanup();

    // 2. Full DOM reset — removes style tags, data attrs, inline styles
    resetEngagementDOM();

    // 3. Re-read settings
    const newSettings = await getSettings();
    mode = newSettings.mode;

    // 4. Start new mode (or no-op)
    if (shouldControlEngagement(platform, mode, newSettings.videoControls)) {
      activeCleanup = startPlatformEngagement(platform, mode, newSettings.videoControls);
    } else {
      activeCleanup = () => {};
    }
  };

  chrome.storage.onChanged.addListener(storageListener);

  // Master cleanup
  return () => {
    activeCleanup();
    resetEngagementDOM();
    chrome.storage.onChanged.removeListener(storageListener);
  };
}
