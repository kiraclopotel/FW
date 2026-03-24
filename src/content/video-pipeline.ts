// FeelingWise - Video Pipeline Orchestrator
// Handles comment CONTENT only: detection → extraction → AI rewriting → overlay injection
// for video-first platforms (YouTube, TikTok, Instagram).
// All engagement hiding/blocking is handled by the engagement controller.

import type { Platform } from '../types/post';
import type { Mode } from '../types/mode';
import { getSettings } from '../storage/settings';
import { safeSendMessage } from './context-guard';
import { extractComments } from './platforms/comment-extractors';
import { scoreAndRankComments } from '../analysis/comment-scorer';
import { generateChildComments, rewriteTeenComments } from '../analysis/comment-rewriter';
import {
  injectChildEducationalOverlay,
  injectTeenRewrittenComments,
  removePlaceholder,
  removeOverlay,
} from './comment-overlay';

// ─── Comments container discovery (per-platform) ───

function getCommentsContainer(platform: Platform): HTMLElement | null {
  switch (platform) {
    case 'youtube':
      return document.querySelector<HTMLElement>('ytd-comments#comments');
    case 'tiktok': {
      const primary = document.querySelector<HTMLElement>('[data-e2e="comment-list"]');
      if (primary && primary.children.length >= 1) return primary;

      const commentPanel = document.querySelector<HTMLElement>(
        '[data-e2e="comment-panel"], [data-e2e="browse-comment"], [class*="CommentPanel"]'
      );
      if (commentPanel) {
        const ul = commentPanel.querySelector<HTMLElement>('ul');
        if (ul && ul.children.length >= 1) return ul;
      }

      const allULs = document.querySelectorAll<HTMLElement>('ul');
      for (const ul of allULs) {
        if (ul.children.length < 2) continue;
        if (ul.dataset.fwProcessed === 'true') continue;
        let commentLike = 0;
        for (const child of Array.from(ul.children).slice(0, 5)) {
          if (child instanceof HTMLElement && child.querySelector('a[href*="/@"]')) {
            commentLike++;
          }
        }
        if (commentLike >= 2) return ul;
      }

      return null;
    }
    case 'instagram':
      return document.querySelector<HTMLElement>('article ul[class]');
    default:
      return null;
  }
}

// ─── Module-level state ───

let cachedMode: Mode = 'child'; // Safest default for synchronous access
let currentPipelineId = '';

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

// ─── Comment pipeline (runs when comment container appears) ───

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

  // Child hidden mode — engagement controller already hides the container
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

  // Prefer container already discovered by engagement controller
  let container: HTMLElement | null =
    document.querySelector<HTMLElement>('[data-fw-comment-section]');
  if (!container) {
    container = getCommentsContainer(platform);
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

  // Load settings so cachedMode is available for pipeline decisions
  getSettings().then(settings => {
    cachedMode = settings.mode;
    modeReady = true;
  });

  // Listen for settings changes so cachedMode stays current
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes.mode) {
      cachedMode = changes.mode.newValue as Mode;
      console.log('[FeelingWise] Mode changed to:', cachedMode);
    }
  };
  chrome.storage.onChanged.addListener(storageListener);

  // ═══ Comment detection (wait for container to appear) ═══
  function tryDetectComments(): void {
    if (!modeReady) return; // Wait until settings have loaded to avoid defaulting to child mode

    // Prefer container already discovered by engagement controller
    let container: HTMLElement | null =
      document.querySelector<HTMLElement>('[data-fw-comment-section]');
    if (!container) {
      container = getCommentsContainer(platform);
    }
    if (!container) return;
    if (container.dataset.fwProcessed === 'true') return;

    container.dataset.fwProcessed = 'true';
    console.log(`[FeelingWise] Comments container detected on ${platform}`);

    // Run comment pipeline (engagement controller handles hiding/blocking)
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
