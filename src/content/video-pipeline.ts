// FeelingWise - Video Pipeline Orchestrator
// Wires together comment detection, hiding, extraction, AI rewriting, and injection
// for video-first platforms (YouTube, TikTok, Instagram).
//
// TWO INDEPENDENT PATHS:
// Path A (immediate): Metrics hiding + comment posting block → runs on page load
// Path B (deferred):  Comment replacement/rewriting → runs when comment container appears
//
// Path A uses dom-scanner's getDiscoveredMetrics() for robust metric discovery.
// Path B still uses getCommentsContainer() with getDiscoveredCommentsContainer() as fallback.

import type { Platform } from '../types/post';
import type { Mode } from '../types/mode';
import { getSettings } from '../storage/settings';
import { getCommentsContainer } from './platforms/metric-selectors';
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

// ─── Module-level state ───

let cachedMode: Mode = 'child'; // Safest default for synchronous access
let currentPipelineId = '';
let metricPollTimer: ReturnType<typeof setInterval> | null = null;

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

// ─── Immediate actions (metrics + posting) ───
// These run ON PAGE LOAD. No dependency on comments existing.

async function runImmediateActions(platform: Platform): Promise<void> {
  const settings = await getSettings();
  const mode = settings.mode;
  const { videoControls } = settings;

  const shouldHideMetrics =
    (mode === 'child' && videoControls.childHideMetrics) ||
    (mode === 'teen' && videoControls.teenHideMetrics) ||
    (mode === 'adult' && videoControls.adultHideMetrics);

  if (shouldHideMetrics) {
    // Use the scanner's discovered metrics (falls back to known selectors internally)
    const { getDiscoveredMetrics } = await import('./platforms/dom-scanner');
    const elements = getDiscoveredMetrics(platform);
    if (elements.length > 0) {
      hideEngagementMetrics(elements);
      console.log(`[FeelingWise] Hidden ${elements.length} metric elements on ${platform}`);
    } else {
      console.log(`[FeelingWise] No metric elements found yet on ${platform}`);
    }
  }

  if (mode === 'child' && videoControls.childBlockPosting) {
    blockCommentPosting(platform);
  }
}

// ─── Metric polling ───
// TikTok/Instagram load new metrics when user swipes/scrolls.
// Re-check every 2 seconds for new unhidden metrics.

function startMetricPolling(platform: Platform): void {
  if (metricPollTimer) return; // Already running

  metricPollTimer = setInterval(async () => {
    try {
      const settings = await getSettings();
      const mode = settings.mode;
      const shouldHide =
        (mode === 'child' && settings.videoControls.childHideMetrics) ||
        (mode === 'teen' && settings.videoControls.teenHideMetrics) ||
        (mode === 'adult' && settings.videoControls.adultHideMetrics);

      if (!shouldHide) return;

      const { getDiscoveredMetrics } = await import('./platforms/dom-scanner');
      const elements = getDiscoveredMetrics(platform);
      const unhidden = elements.filter(el => el.dataset.fwMetricHidden !== 'true');
      if (unhidden.length > 0) {
        hideEngagementMetrics(unhidden);
      }
    } catch {
      // Non-critical — metric polling failure should never break anything
    }
  }, 2000);
}

function stopMetricPolling(): void {
  if (metricPollTimer) {
    clearInterval(metricPollTimer);
    metricPollTimer = null;
  }
}

// ─── Comment pipeline (deferred — runs when comment container appears) ───

async function runCommentPipeline(
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

  // Child hidden mode — container stays hidden from hideCommentsImmediately
  if (mode === 'child' && videoControls.childCommentMode === 'hidden') {
    logScanEvent(platform, 'comments-hidden', videoTitle);
    return;
  }

  // Adult mode: no comment intervention
  if (mode === 'adult') {
    logScanEvent(platform, 'pass', videoTitle);
    return;
  }

  // Extract + score comments
  const rawComments = extractComments(platform);
  const batch = scoreAndRankComments(rawComments, videoControls.commentAnalysisCount);

  if (currentPipelineId !== pipelineId) return; // Stale check

  const { getDiscoveredCommentsContainer } = await import('./platforms/dom-scanner');
  const container = getCommentsContainer(platform) ?? getDiscoveredCommentsContainer(platform);
  if (!container) {
    logScanEvent(platform, 'pass', videoTitle);
    return;
  }

  try {
    if (mode === 'child' && videoControls.childCommentMode === 'educational') {
      const result = await generateChildComments(
        videoTitle, videoDescription, videoControls.educationalTopics,
        language, videoControls.commentAnalysisCount,
      );
      if (currentPipelineId !== pipelineId) return;
      if (result.comments.length > 0) {
        injectChildEducationalOverlay(container, result);
      }
      logScanEvent(platform, 'comments-educational', videoTitle);
      return;
    }

    if (mode === 'teen' && videoControls.teenRewriteComments && batch.top.length > 0) {
      const result = await rewriteTeenComments(batch.top, videoTitle, language);
      if (currentPipelineId !== pipelineId) return;
      if (result.comments.length > 0) {
        injectTeenRewrittenComments(container, result, videoControls.teenShowLessons);
      }
      logScanEvent(platform, 'comments-rewritten', videoTitle);
      return;
    }
  } catch (err) {
    console.error('[FeelingWise] Comment pipeline error:', err);
    // Restore visibility on failure so comments aren't permanently hidden
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

// ─── Init (entry point) ───

const FALLBACK_POLL_INTERVAL_MS = 2000;
const FALLBACK_MAX_ATTEMPTS = 10;

export function initVideoPipeline(platform: Platform): () => void {
  let observer: MutationObserver | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let fallbackAttempts = 0;

  console.log(`[FeelingWise] Video pipeline initializing for ${platform}`);

  // ═══ PATH A: Immediate actions (don't wait for comments) ═══
  getSettings().then(settings => {
    cachedMode = settings.mode;
    // Run immediately
    runImmediateActions(platform);
    // Start polling for new metrics (catches swipe-to-new-video)
    startMetricPolling(platform);
  });

  // ═══ PATH B: Comment detection (wait for container to appear) ═══
  function tryDetectComments(): void {
    const container = getCommentsContainer(platform);
    if (!container) return;
    if (container.dataset.fwProcessed === 'true') return;

    container.dataset.fwProcessed = 'true';
    console.log(`[FeelingWise] Comments container detected on ${platform}`);

    // HIDE IMMEDIATELY (synchronous — before any async work)
    const mode = getCachedMode();
    if (mode === 'child' || mode === 'teen') {
      hideCommentsImmediately(container, mode);
    }

    // Run comment pipeline (async — container is already hidden)
    const title = getCurrentVideoTitle(platform);
    const desc = getCurrentVideoDescription(platform);
    runCommentPipeline(platform, title, desc)
      .catch(err => console.error('[FeelingWise] Comment pipeline error:', err));
  }

  observer = new MutationObserver(() => {
    tryDetectComments();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Check if comments already present on load
  tryDetectComments();

  // Fallback polling for late-loading comments
  fallbackTimer = setInterval(() => {
    fallbackAttempts++;
    tryDetectComments();
    if (fallbackAttempts >= FALLBACK_MAX_ATTEMPTS && fallbackTimer !== null) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }, FALLBACK_POLL_INTERVAL_MS);

  // SPA navigation
  const cleanupNavigation = setupNavigationListeners(platform);

  const handleNav = () => {
    onNavigate(platform);
    fallbackAttempts = 0;
    // Re-run immediate actions for the new video
    runImmediateActions(platform);
    // Reset comment fallback polling
    if (!fallbackTimer) {
      fallbackTimer = setInterval(() => {
        fallbackAttempts++;
        tryDetectComments();
        if (fallbackAttempts >= FALLBACK_MAX_ATTEMPTS && fallbackTimer !== null) {
          clearInterval(fallbackTimer);
          fallbackTimer = null;
        }
      }, FALLBACK_POLL_INTERVAL_MS);
    }
  };

  if (platform === 'youtube') {
    document.addEventListener('yt-navigate-finish', handleNav);
  }
  if (platform === 'tiktok' || platform === 'instagram') {
    window.addEventListener('popstate', handleNav);
    // URL polling for swipe detection is already handled by setupNavigationListeners
  }

  return () => {
    observer?.disconnect();
    observer = null;
    if (fallbackTimer !== null) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
    stopMetricPolling();
    cleanupNavigation();
    if (platform === 'youtube') {
      document.removeEventListener('yt-navigate-finish', handleNav);
    }
    if (platform === 'tiktok' || platform === 'instagram') {
      window.removeEventListener('popstate', handleNav);
    }
  };
}
