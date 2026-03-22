// FeelingWise - Content script entry point
// Detects the current platform, loads the appropriate adapter,
// and starts the MutationObserver to intercept posts.

import { detectCurrentPlatform } from './platforms/adapter';
import { TwitterAdapter } from './platforms/twitter';
import { FacebookAdapter } from './platforms/facebook';
import { FourchanAdapter } from './platforms/fourchan';
import { YoutubeAdapter } from './platforms/youtube';
import { RedditAdapter } from './platforms/reddit';
import { TiktokAdapter } from './platforms/tiktok';
import { InstagramAdapter } from './platforms/instagram';
import { ContentInterceptor } from './interceptor';
import { PostContent } from '../types/post';
import { PlatformAdapter } from './platforms/adapter';
import { process as processPipeline, PipelineResult } from '../core/pipeline';
import { ScanEvent } from '../forensics/scan-log';
import { getSettings } from '../storage/settings';
import { injectIntoElement } from './injector';
import { ProcessingQueue } from './queue';
import { initVideoPipeline } from './video-pipeline';
import { scanDOM } from './platforms/dom-scanner';

let activeAdapter: PlatformAdapter | null = null;
let queue: ProcessingQueue | null = null;

function init(): void {
  const platform = detectCurrentPlatform();
  if (!platform) return; // not a supported platform

  const adapter = resolveAdapter(platform);
  if (!adapter) {
    console.warn(`[FeelingWise] No adapter for platform: ${platform}`);
    return;
  }

  activeAdapter = adapter;
  queue = new ProcessingQueue(processPipeline, onProcessingResult);
  const interceptor = new ContentInterceptor(adapter, onPostDetected);
  interceptor.start();

  // Video platforms: start the video pipeline (comment hiding, metrics, overlays)
  if (platform === 'youtube' || platform === 'tiktok' || platform === 'instagram') {
    initVideoPipeline(platform);
  }

  console.log(`[FeelingWise] active on ${platform}`);

  // DOM diagnostic — runs once on load, exposes __FW_SCAN() for manual inspection
  // Auto-scan after a short delay (let platform finish rendering)
  setTimeout(() => {
    if (platform) {
      scanDOM(platform);
    }
  }, 3000);

  // Manual scan for debugging: type __FW_SCAN() in DevTools console
  if (platform) {
    const p = platform;
    (window as any).__FW_SCAN = () => scanDOM(p);
    console.log('[FeelingWise] Type __FW_SCAN() in console to run DOM diagnostic');
  }
}

async function onPostDetected(post: PostContent): Promise<void> {
  if (!queue) return;

  // Child mode on video platforms: the video pipeline handles ALL protection
  // (metric hiding, comment replacement, input blocking).
  // Text caption scanning adds zero value — it costs API calls and produces
  // no visible neutralization because the child sees educational content, not comments.
  const isVideoPlatform = post.platform === 'tiktok' || post.platform === 'youtube' || post.platform === 'instagram';
  if (isVideoPlatform) {
    const settings = await getSettings();
    if (settings.mode === 'child') {
      return;
    }
  }

  const el = post.domRef.deref();
  const isVisible = el ? isInViewport(el) : false;
  queue.enqueue(post, isVisible);
}

function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

function onProcessingResult(post: PostContent, result: PipelineResult): void {
  // Log scan event for ALL processed posts (pass, neutralize, flag)
  // This gives the denominator for dashboard metrics
  chrome.runtime.sendMessage({
    type: 'SCAN_LOG',
    payload: {
      timestamp: new Date().toISOString(),
      platform: post.platform,
      feedSource: post.feedSource ?? 'unknown',
      author: post.author ?? 'unknown',
      postId: post.id,
      action: result.action,
    } satisfies ScanEvent,
  }).catch(() => {}); // Non-critical

  if ((result.action === 'neutralize' || result.action === 'flag') && result.neutralized && activeAdapter) {
    // Get mode for injection styling
    getSettings().then(settings => {
      const el = post.domRef.deref();

      if (el) {
        injectIntoElement(el, result.neutralized!, settings.mode);
      } else if (result.action === 'neutralize') {
        // Only fallback-replace for neutralize (child/teen), not flag (adult)
        activeAdapter!.replaceContent(post.domRef, result.neutralized!.rewrittenText);
      }

      // Send forensic data to service worker for storage in extension-origin IndexedDB.
      // Content scripts run in the webpage's origin, so writing IndexedDB here would
      // be invisible to the dashboard (which runs in the extension origin).
      let postUrl = '';
      if (post.platform === 'twitter' && post.author && post.id) {
        const handle = post.author.replace(/^@/, '');
        if (/^[A-Za-z0-9_]+$/.test(handle)) {
          postUrl = `https://x.com/${handle}/status/${post.id}`;
        }
      }

      chrome.runtime.sendMessage({
        type: 'FORENSIC_LOG',
        payload: {
          originalText: post.text,
          neutralizedText: result.neutralized!.rewrittenText,
          analysis: result.neutralized!.analysis,
          mode: settings.mode,
          platform: post.platform,
          aiSource: result.neutralized!.aiSource,
          author: post.author,
          postUrl,
          feedSource: post.feedSource ?? 'unknown',
          aiModel: result.aiMeta?.model,
          aiProvider: result.aiMeta?.provider,
          detectionMode: result.detectionMode,
          configSnapshot: {
            mode: settings.mode,
            threshold: settings.mode === 'child' ? 0.45 : settings.mode === 'teen' ? 0.40 : 0.35,
            dailyCap: settings.dailyCap,
          },
        },
      }).catch(err => { console.error('[FeelingWise] Forensic logging error:', err); });
    });

    // Notify service worker for stats tracking
    const confirmedTechniques = result.neutralized.analysis.techniques
      .filter(t => t.present)
      .map(t => t.technique);

    chrome.runtime.sendMessage({
      type: 'NEUTRALIZATION_COMPLETE',
      payload: {
        postId: post.id,
        techniques: confirmedTechniques,
        confidence: result.neutralized.analysis.overallConfidence,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => {}); // ignore if popup not open

    console.log(`[FeelingWise] ${result.action === 'flag' ? 'Flagged' : 'Neutralized'} post ${post.id}`);
  }

  // Author intelligence: update profile for every processed post (flagged or not)
  if (post.author) {
    const flagged = result.action !== 'pass';
    const techniques = flagged && result.neutralized
      ? result.neutralized.analysis.techniques.filter(t => t.present).map(t => t.technique)
      : [];
    chrome.runtime.sendMessage({
      type: 'AUTHOR_UPDATE',
      payload: {
        author: post.author,
        platform: post.platform,
        flagged,
        techniques,
      },
    }).catch(() => {});
  }
}

function resolveAdapter(platform: ReturnType<typeof detectCurrentPlatform>) {
  switch (platform) {
    case 'twitter':
      return new TwitterAdapter();
    case 'facebook':
      return new FacebookAdapter();
    case 'instagram':
      return new InstagramAdapter();
    case 'reddit':
      return new RedditAdapter();
    case '4chan':
      return new FourchanAdapter();
    case 'youtube':
      return new YoutubeAdapter();
    case 'tiktok':
      return new TiktokAdapter();
    default:
      return null;
  }
}

// ─── API status indicator ───
function showApiWarning(): void {
  if (document.querySelector('.fw-api-warning')) return;
  const div = document.createElement('div');
  div.className = 'fw-api-warning';
  div.textContent = '\u26A1 FeelingWise: API disconnected \u2014 click extension icon to reconnect';
  Object.assign(div.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '99999',
    background: 'rgb(22,24,28)',
    border: '1px solid #ffab40',
    color: '#ffab40',
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '8px',
    opacity: '0.9',
    cursor: 'pointer',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });
  div.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' }).catch(() => {});
    div.remove();
  });
  document.body.appendChild(div);
}

function removeApiWarning(): void {
  document.querySelector('.fw-api-warning')?.remove();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FW_API_DISCONNECTED') showApiWarning();
  if (msg.type === 'FW_API_CONNECTED') removeApiWarning();
});

init();
