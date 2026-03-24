// FeelingWise - Video Pipeline Orchestrator
// Wires together comment detection, hiding, extraction, AI rewriting, and injection
// for video-first platforms (YouTube, TikTok, Instagram).
//
// TWO INDEPENDENT PATHS:
// Path A (immediate): Comment posting block + action button blocking → runs on page load
// Path B (deferred):  Comment replacement/rewriting → runs when comment container appears

import type { Platform } from '../types/post';
import type { Mode } from '../types/mode';
import { getSettings } from '../storage/settings';
import { safeSendMessage, isContextAlive } from './context-guard';
import { getCommentsContainer } from './platforms/metric-selectors';
import { getDiscoveredCommentsContainer } from './platforms/dom-scanner';
import { extractComments } from './platforms/comment-extractors';
import { scoreAndRankComments } from '../analysis/comment-scorer';
import { generateChildComments, rewriteTeenComments } from '../analysis/comment-rewriter';
import {
  hideCommentsImmediately,
  hideTikTokCommentsDirectCSS,
  injectChildEducationalOverlay,
  injectTeenRewrittenComments,
  blockCommentPosting,
} from './video-comment-injector';

// ─── Module-level state ───

let cachedMode: Mode = 'child'; // Safest default for synchronous access
let currentPipelineId = '';
let actionPollTimer: ReturnType<typeof setInterval> | null = null;
let tiktokChildCleanup: (() => void) | null = null;

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
  safeSendMessage({
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
}

// ─── Immediate actions (posting block) ───
// These run ON PAGE LOAD. No dependency on comments existing.
// Action button blocking is handled by action-blocker.ts (centralized, all platforms).

async function runImmediateActions(platform: Platform): Promise<void> {
  const settings = await getSettings();
  const mode = settings.mode;
  const { videoControls } = settings;

  if (mode === 'child' && videoControls.childBlockPosting) {
    blockCommentPosting(platform);
  }
}

// ─── Comment posting polling ───
// TikTok/Instagram load new elements when user swipes/scrolls.
// Re-check every 2 seconds to block comment posting inputs.
// Action button blocking is handled by action-blocker.ts.

function startPostingPolling(platform: Platform): void {
  if (actionPollTimer) return; // Already running

  actionPollTimer = setInterval(async () => {
    if (!isContextAlive()) { stopPostingPolling(); return; }
    try {
      const settings = await getSettings();
      if (settings.mode === 'child' && settings.videoControls.childBlockPosting) {
        blockCommentPosting(platform);
      }
    } catch {
      // Non-critical — polling failure should never break anything
    }
  }, 2000);
}

function stopPostingPolling(): void {
  if (actionPollTimer) {
    clearInterval(actionPollTimer);
    actionPollTimer = null;
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

  let container: HTMLElement | null;
  if (platform === 'tiktok') {
    // TikTok: find the comment area using the actual DOM structure
    container = document.querySelector<HTMLElement>(
      '[data-e2e="comment-panel"], [data-e2e="browse-comment"]'
    );
    if (!container) {
      const firstComment = document.querySelector<HTMLElement>('[data-e2e="comment-level-1"]');
      container = firstComment?.parentElement ?? null;
    }
  } else {
    container = getCommentsContainer(platform) ?? getDiscoveredCommentsContainer(platform);
  }
  if (!container) {
    logScanEvent(platform, 'pass', videoTitle);
    return;
  }

  try {
    if (mode === 'child' && videoControls.childCommentMode === 'educational') {
      // On TikTok, the caption IS the description (getCurrentVideoDescription returns '')
      const desc = platform === 'tiktok' ? videoTitle : videoDescription;

      // Extract a few actual comments for topic context (not for manipulation detection)
      const sampleTexts = rawComments
        .slice(0, 5)
        .map(c => c.text)
        .filter(t => t.length > 10 && t.length < 200)
        .join('; ');

      const contextDesc = sampleTexts
        ? `${desc}\n\nSample discussion topics: ${sampleTexts}`
        : desc;

      const result = await generateChildComments(
        videoTitle, contextDesc, videoControls.educationalTopics,
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
  // Clean up TikTok child mode direct CSS + observer
  if (tiktokChildCleanup) {
    tiktokChildCleanup();
    tiktokChildCleanup = null;
  }

  // Remove any injected overlays from previous video (both old and new class names)
  document.querySelectorAll('.fw-overlay, .fw-comment-overlay, .fw-comments-placeholder').forEach(el => el.remove());

  // Reset processing flags on comment containers so MutationObserver re-detects
  const container = getCommentsContainer(platform);
  if (container) {
    delete container.dataset.fwProcessed;
    delete container.dataset.fwHidden;
    container.removeAttribute('data-fw-comment-container');
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
  let modeReady = false;

  console.log(`[FeelingWise] Video pipeline initializing for ${platform}`);

  // ═══ PATH A: Immediate actions (don't wait for comments) ═══
  getSettings().then(settings => {
    cachedMode = settings.mode;
    modeReady = true;
    // Run immediately
    runImmediateActions(platform);
    // Start polling for comment posting block (catches swipe-to-new-video)
    startPostingPolling(platform);
  });

  // Listen for settings changes so cachedMode stays current
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes.mode) {
      cachedMode = changes.mode.newValue as Mode;
      console.log('[FeelingWise] Mode changed to:', cachedMode);
      runImmediateActions(platform);
    }
  };
  chrome.storage.onChanged.addListener(storageListener);

  // ═══ PATH B: Comment detection (wait for container to appear) ═══
  function tryDetectComments(): void {
    if (!modeReady) return; // Wait until settings have loaded to avoid defaulting to child mode

    // TikTok child mode: use direct CSS targeting, bypass container detection entirely
    if (platform === 'tiktok' && getCachedMode() === 'child') {
      if (!tiktokChildCleanup) {
        tiktokChildCleanup = hideTikTokCommentsDirectCSS();
        blockCommentPosting('tiktok');
        const title = getCurrentVideoTitle('tiktok');
        logScanEvent('tiktok', 'comments-hidden', title);
        console.log('[FeelingWise] TikTok child mode: comments hidden via direct CSS targeting');

        // Also run the educational pipeline if configured
        getSettings().then(s => {
          if (s.videoControls.childCommentMode === 'educational') {
            const desc = getCurrentVideoDescription('tiktok');
            runCommentPipeline('tiktok', title, desc)
              .catch(err => console.error('[FeelingWise] Comment pipeline error:', err));
          }
        });
      }
      return; // Skip all container-based logic
    }

    const container = getCommentsContainer(platform) ?? getDiscoveredCommentsContainer(platform);
    if (!container) return;
    if (container.dataset.fwProcessed === 'true') return;

    container.dataset.fwProcessed = 'true';
    console.log(`[FeelingWise] Comments container detected on ${platform}`);

    // HIDE IMMEDIATELY (synchronous — before any async work)
    const mode = getCachedMode();
    if (mode === 'child' || mode === 'teen') {
      hideCommentsImmediately(container, mode);
      console.log(`[FeelingWise] After hideCommentsImmediately, fwHidden: ${container.dataset.fwHidden}, mode: ${mode}`);
    }

    // Block comment posting immediately — child mode protects first
    if (mode === 'child') {
      blockCommentPosting(platform);
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
    if (tiktokChildCleanup) {
      tiktokChildCleanup();
      tiktokChildCleanup = null;
    }
    observer?.disconnect();
    observer = null;
    if (fallbackTimer !== null) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
    stopPostingPolling();
    cleanupNavigation();
    chrome.storage.onChanged.removeListener(storageListener);
    if (platform === 'youtube') {
      document.removeEventListener('yt-navigate-finish', handleNav);
    }
    if (platform === 'tiktok' || platform === 'instagram') {
      window.removeEventListener('popstate', handleNav);
    }
  };
}
