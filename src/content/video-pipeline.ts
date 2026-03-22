// FeelingWise - Video Pipeline Orchestrator
// Wires together comment detection, hiding, extraction, AI rewriting, and injection
// for video-first platforms (YouTube, TikTok, Instagram).
//
// CRITICAL SEQUENCE:
// 1. MutationObserver detects comments container → IMMEDIATELY hide (synchronous, no await)
// 2. Extract + score comments (async pipeline begins)
// 3. Based on mode: generate educational content OR rewrite comments
// 4. Inject overlay
// Step 1 uses getCachedMode() — synchronous, never async in the observer callback.

import type { Platform } from '../types/post';
import type { Mode } from '../types/mode';
import { getSettings } from '../storage/settings';
import { getCommentsContainer, getMetricElements } from './platforms/metric-selectors';
import { extractComments } from './platforms/comment-extractors';
import { scoreAndRankComments } from '../analysis/comment-scorer';
import { generateChildComments, rewriteTeenComments } from '../analysis/comment-rewriter';
import {
  hideCommentsImmediately,
  injectChildEducationalOverlay,
  injectTeenRewrittenComments,
  hideEngagementMetrics,
  blockCommentPosting,
} from './video-comment-injector';

// --- Module-level state ---

// Cached mode for synchronous access in MutationObserver callback.
// Defaults to 'child' (safest — hide first, adjust later if settings load reveals adult).
let cachedMode: Mode = 'child';

// Stale response protection: each pipeline run gets a unique ID.
// If the user navigates before AI responds, the old result is discarded.
let currentPipelineId = '';

function getCachedMode(): Mode {
  return cachedMode;
}

// --- Video metadata extraction ---

function getCurrentVideoTitle(platform: Platform): string {
  switch (platform) {
    case 'youtube': {
      const el = document.querySelector<HTMLElement>(
        'h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string'
      );
      return el?.textContent?.trim() || document.title;
    }
    case 'tiktok': {
      const el = document.querySelector<HTMLElement>(
        '[data-e2e="browse-video-desc"], [data-e2e="video-desc"]'
      );
      return el?.textContent?.trim() || document.title;
    }
    case 'instagram':
      return document.title;
    default:
      return document.title;
  }
}

function getCurrentVideoDescription(platform: Platform): string {
  switch (platform) {
    case 'youtube': {
      const el = document.querySelector<HTMLElement>(
        'ytd-text-inline-expander #snippet-text, ytd-expander #description'
      );
      return el?.textContent?.trim().slice(0, 300) || '';
    }
    case 'tiktok':
    case 'instagram':
      return '';
    default:
      return '';
  }
}

// --- Forensic logging ---

function logScanEvent(
  platform: Platform,
  action: 'comments-hidden' | 'comments-educational' | 'comments-rewritten' | 'pass',
  videoTitle: string,
): void {
  try {
    chrome.runtime.sendMessage({
      type: 'SCAN_LOG',
      payload: {
        platform,
        action,
        feedSource: 'video' as const,
        author: 'unknown',
        postId: videoTitle.slice(0, 80),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Logging failure must never break the pipeline.
  }
}

// --- Main pipeline ---

async function runVideoPipeline(
  platform: Platform,
  videoTitle: string,
  videoDescription: string,
): Promise<void> {
  const pipelineId = `${platform}-${Date.now()}`;
  currentPipelineId = pipelineId;

  const settings = await getSettings();
  const mode = settings.mode;
  const { videoControls, locale } = settings;
  const language = locale === 'ro' ? 'Romanian' : 'English';

  // Step 5+6: metrics and posting (no dependency on comments, run immediately)
  const shouldHideMetrics =
    (mode === 'child' && videoControls.childHideMetrics) ||
    (mode === 'teen' && videoControls.teenHideMetrics) ||
    (mode === 'adult' && videoControls.adultHideMetrics);

  if (shouldHideMetrics) {
    hideEngagementMetrics(getMetricElements(platform));
  }

  if (mode === 'child' && videoControls.childBlockPosting) {
    blockCommentPosting(platform);
  }

  // Step 4a: child hidden mode — container stays hidden from step 1, nothing more to do
  if (mode === 'child' && videoControls.childCommentMode === 'hidden') {
    logScanEvent(platform, 'comments-hidden', videoTitle);
    return;
  }

  // Adult mode: no comment intervention
  if (mode === 'adult') {
    logScanEvent(platform, 'pass', videoTitle);
    return;
  }

  // Step 2: extract + score comments
  const rawComments = extractComments(platform);
  const batch = scoreAndRankComments(rawComments, videoControls.commentAnalysisCount);

  // Stale check: user may have navigated away during extraction
  if (currentPipelineId !== pipelineId) return;

  const container = getCommentsContainer(platform);
  if (!container) {
    logScanEvent(platform, 'pass', videoTitle);
    return;
  }

  try {
    // Step 4b: child educational mode
    if (mode === 'child' && videoControls.childCommentMode === 'educational') {
      const result = await generateChildComments(
        videoTitle,
        videoDescription,
        videoControls.educationalTopics,
        language,
        videoControls.commentAnalysisCount,
      );

      // Stale check after async AI call
      if (currentPipelineId !== pipelineId) return;

      if (result.comments.length > 0) {
        injectChildEducationalOverlay(container, result);
      }
      logScanEvent(platform, 'comments-educational', videoTitle);
      return;
    }

    // Step 4c: teen rewrite mode
    if (mode === 'teen' && videoControls.teenRewriteComments && batch.top.length > 0) {
      const result = await rewriteTeenComments(batch.top, videoTitle, language);

      // Stale check after async AI call
      if (currentPipelineId !== pipelineId) return;

      if (result.comments.length > 0) {
        injectTeenRewrittenComments(container, result, videoControls.teenShowLessons);
      }
      logScanEvent(platform, 'comments-rewritten', videoTitle);
      return;
    }
  } catch (err) {
    // On failure, restore container visibility so comments aren't permanently hidden
    console.error('[FeelingWise] Video pipeline error:', err);
    container.style.visibility = 'visible';
    container.style.maxHeight = '';
    container.style.overflow = '';
    return;
  }

  logScanEvent(platform, 'pass', videoTitle);
}

// --- SPA navigation handling ---

function onNavigate(platform: Platform): void {
  // Remove any injected overlays from previous video
  document.querySelectorAll('.fw-overlay, .fw-comments-placeholder').forEach(el => el.remove());

  // Reset processing flags on comment containers so MutationObserver re-detects
  const container = getCommentsContainer(platform);
  if (container) {
    delete container.dataset.fwProcessed;
    delete container.dataset.fwHidden;
    container.style.visibility = '';
    container.style.maxHeight = '';
    container.style.overflow = '';
  }
}

function setupNavigationListeners(platform: Platform): () => void {
  const handlers: (() => void)[] = [];

  const handleNav = () => onNavigate(platform);

  if (platform === 'youtube') {
    // YouTube fires a custom event on SPA navigation
    document.addEventListener('yt-navigate-finish', handleNav);
    handlers.push(() => document.removeEventListener('yt-navigate-finish', handleNav));
  }

  if (platform === 'tiktok' || platform === 'instagram') {
    // TikTok and Instagram: popstate + URL polling for swipe/tap navigation
    window.addEventListener('popstate', handleNav);
    handlers.push(() => window.removeEventListener('popstate', handleNav));

    let lastUrl = location.href;
    const urlPollTimer = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        handleNav();
      }
    }, 1000);
    handlers.push(() => clearInterval(urlPollTimer));
  }

  return () => handlers.forEach(fn => fn());
}

// --- Init ---

const FALLBACK_POLL_INTERVAL_MS = 2000;
const FALLBACK_MAX_ATTEMPTS = 10;

export function initVideoPipeline(platform: Platform): () => void {
  let observer: MutationObserver | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let fallbackAttempts = 0;

  // Load settings and cache mode for synchronous access
  getSettings().then(settings => {
    cachedMode = settings.mode;
  });

  function tryDetectAndProcess(): void {
    const container = getCommentsContainer(platform);
    if (!container) return;
    if (container.dataset.fwProcessed === 'true') return;

    container.dataset.fwProcessed = 'true';

    // STEP 1: HIDE IMMEDIATELY (synchronous, no await)
    const mode = getCachedMode();
    if (mode === 'child' || mode === 'teen') {
      hideCommentsImmediately(container, mode);
    }

    // STEPS 2-7: Run full pipeline (async, container is already hidden)
    const title = getCurrentVideoTitle(platform);
    const desc = getCurrentVideoDescription(platform);
    runVideoPipeline(platform, title, desc)
      .catch(err => console.error('[FeelingWise] Video pipeline error:', err));
  }

  // Primary: MutationObserver
  observer = new MutationObserver(() => {
    tryDetectAndProcess();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Check if container is already present on page load
  tryDetectAndProcess();

  // Fallback: periodic polling for platforms that load comments late
  fallbackTimer = setInterval(() => {
    fallbackAttempts++;
    tryDetectAndProcess();
    if (fallbackAttempts >= FALLBACK_MAX_ATTEMPTS && fallbackTimer !== null) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }, FALLBACK_POLL_INTERVAL_MS);

  // SPA navigation listeners
  const cleanupNavigation = setupNavigationListeners(platform);

  // On navigation, reset fallback counter so polling restarts for new video
  const originalOnNavigate = onNavigate;
  const wrappedHandleNav = () => {
    fallbackAttempts = 0;
    if (!fallbackTimer) {
      fallbackTimer = setInterval(() => {
        fallbackAttempts++;
        tryDetectAndProcess();
        if (fallbackAttempts >= FALLBACK_MAX_ATTEMPTS && fallbackTimer !== null) {
          clearInterval(fallbackTimer);
          fallbackTimer = null;
        }
      }, FALLBACK_POLL_INTERVAL_MS);
    }
  };

  // Hook into navigation events to restart polling
  if (platform === 'youtube') {
    document.addEventListener('yt-navigate-finish', wrappedHandleNav);
  }
  if (platform === 'tiktok' || platform === 'instagram') {
    window.addEventListener('popstate', wrappedHandleNav);
  }

  return () => {
    observer?.disconnect();
    observer = null;
    if (fallbackTimer !== null) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
    cleanupNavigation();
    if (platform === 'youtube') {
      document.removeEventListener('yt-navigate-finish', wrappedHandleNav);
    }
    if (platform === 'tiktok' || platform === 'instagram') {
      window.removeEventListener('popstate', wrappedHandleNav);
    }
  };
}
