// FeelingWise - Content script entry point
// Detects the current platform, loads the appropriate adapter,
// and starts the MutationObserver to intercept posts.
//
// Phase 2 proof: logs extracted post text to console.
// No detection pipeline runs yet — that's Phase 3+.

import { detectCurrentPlatform } from './platforms/adapter';
import { TwitterAdapter } from './platforms/twitter';
import { ContentInterceptor } from './interceptor';
import { PostContent } from '../types/post';

function init(): void {
  const platform = detectCurrentPlatform();
  if (!platform) return; // not a supported platform

  const adapter = resolveAdapter(platform);
  if (!adapter) {
    console.warn(`[FeelingWise] No adapter for platform: ${platform}`);
    return;
  }

  const interceptor = new ContentInterceptor(adapter, onPostDetected);
  interceptor.start();

  console.log(`[FeelingWise] active on ${platform}`);
}

function onPostDetected(post: PostContent): void {
  // Phase 2: just log the extracted text to prove interception works
  console.log(`[FeelingWise] post intercepted on ${post.platform}:`, {
    id: post.id,
    author: post.author,
    text: post.text,
  });

  // Phase 3+: send to detection pipeline via chrome.runtime.sendMessage
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
