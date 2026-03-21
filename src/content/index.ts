// FeelingWise - Content script entry point
// Detects the current platform, loads the appropriate adapter,
// and starts the MutationObserver to intercept posts.

import { detectCurrentPlatform } from './platforms/adapter';
import { TwitterAdapter } from './platforms/twitter';
import { FacebookAdapter } from './platforms/facebook';
import { FourchanAdapter } from './platforms/fourchan';
import { ContentInterceptor } from './interceptor';
import { PostContent } from '../types/post';
import { PlatformAdapter } from './platforms/adapter';
import { process } from '../core/pipeline';
import { getSettings } from '../storage/settings';
import { injectIntoElement } from './injector';
let activeAdapter: PlatformAdapter | null = null;

function init(): void {
  const platform = detectCurrentPlatform();
  if (!platform) return; // not a supported platform

  const adapter = resolveAdapter(platform);
  if (!adapter) {
    console.warn(`[FeelingWise] No adapter for platform: ${platform}`);
    return;
  }

  activeAdapter = adapter;
  const interceptor = new ContentInterceptor(adapter, onPostDetected);
  interceptor.start();

  console.log(`[FeelingWise] active on ${platform}`);
}

async function onPostDetected(post: PostContent): Promise<void> {
  const result = await process(post);

  if ((result.action === 'neutralize' || result.action === 'flag') && result.neutralized && activeAdapter) {
    // Get mode for injection styling
    const settings = await getSettings();
    const el = post.domRef.deref();

    if (el) {
      injectIntoElement(el, result.neutralized, settings.mode);
    } else if (result.action === 'neutralize') {
      // Only fallback-replace for neutralize (child/teen), not flag (adult)
      activeAdapter.replaceContent(post.domRef, result.neutralized.rewrittenText);
    }

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

    // Construct post URL when possible
    let postUrl = '';
    if (post.platform === 'twitter' && post.author && post.id) {
      // Only build URL if author looks like a valid handle (no spaces, alphanumeric + underscores).
      // The _extractAuthor fallback can return display names with spaces which break the URL.
      const handle = post.author.replace(/^@/, '');
      if (/^[A-Za-z0-9_]+$/.test(handle)) {
        postUrl = `https://x.com/${handle}/status/${post.id}`;
      }
    }

    // Send forensic data to service worker for storage in extension-origin IndexedDB.
    // Content scripts run in the webpage's origin, so writing IndexedDB here would
    // be invisible to the dashboard (which runs in the extension origin).
    chrome.runtime.sendMessage({
      type: 'FORENSIC_LOG',
      payload: {
        originalText: post.text,
        neutralizedText: result.neutralized.rewrittenText,
        analysis: result.neutralized.analysis,
        mode: settings.mode,
        platform: post.platform,
        aiSource: result.neutralized.aiSource,
        author: post.author,
        postUrl,
        feedSource: post.feedSource ?? 'unknown',
      },
    }).catch(err => { console.error('[FeelingWise] Forensic logging error:', err); });

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
    // TODO: import and return RedditAdapter once created
    case 'reddit':
      return null;
    case '4chan':
      return new FourchanAdapter();
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
