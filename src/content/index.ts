// FeelingWise - Content script entry point
// Detects the current platform, loads the appropriate adapter,
// and starts the MutationObserver to intercept posts.
//
// Phase 3: intercepted posts are run through Layer 1 detection pipeline.
// Analysis results are logged to console.

import { detectCurrentPlatform } from './platforms/adapter';
import { TwitterAdapter } from './platforms/twitter';
import { ContentInterceptor } from './interceptor';
import { PostContent } from '../types/post';
import { detect } from '../core/detector';

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
  const startTime = performance.now();
  const techniques = detect(post.text, post.author, post.platform);
  const processingTimeMs = performance.now() - startTime;

  const detected = techniques.filter(t => t.present);

  console.log(`[FeelingWise] Analysis Result`, {
    postId: post.id,
    author: post.author,
    text: post.text.substring(0, 100),
    techniques: detected.map(t => ({
      name: t.technique,
      severity: t.severity,
      confidence: t.confidence,
      evidence: t.evidence,
    })),
    totalTechniques: detected.length,
    processingTimeMs: Math.round(processingTimeMs * 100) / 100,
  });

  // Phase 4+: send to Layer 2 verification via chrome.runtime.sendMessage
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
