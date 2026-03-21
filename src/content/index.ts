// FeelingWise - Content script entry point
// Detects the current platform, loads the appropriate adapter,
// and starts the MutationObserver to intercept posts.

import { detectCurrentPlatform } from './platforms/adapter';
import { TwitterAdapter } from './platforms/twitter';
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

  if (result.action === 'neutralize' && result.neutralized && activeAdapter) {
    // Get mode for injection styling
    const settings = await getSettings();
    const el = post.domRef.deref();

    if (el) {
      injectIntoElement(el, result.neutralized, settings.mode);
    } else {
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

    console.log(`[FeelingWise] Neutralized post ${post.id}`);
  }
}

function resolveAdapter(platform: ReturnType<typeof detectCurrentPlatform>) {
  switch (platform) {
    case 'twitter':
      return new TwitterAdapter();
    // Phase 10: other platforms added here
    default:
      return null;
  }
}

init();
