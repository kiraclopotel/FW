// FeelingWise - Content script entry point
// Detects the current platform, loads the appropriate adapter,
// and starts the MutationObserver to intercept posts.
//
// Phase 4: intercepted posts are run through the full 3-layer pipeline.

import { detectCurrentPlatform } from './platforms/adapter';
import { TwitterAdapter } from './platforms/twitter';
import { ContentInterceptor } from './interceptor';
import { PostContent } from '../types/post';
import { PlatformAdapter } from './platforms/adapter';
import { process } from '../core/pipeline';

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
    activeAdapter.replaceContent(post.domRef, result.neutralized.rewrittenText);
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
