// FeelingWise - Centralized Action Button Blocker
// Hides like/comment/share/bookmark buttons on all supported platforms.
// Runs as a standalone polling loop, independent of the video pipeline.

import { getSettings } from '../storage/settings';
import type { BlockActionsPlatforms } from '../storage/settings';
import { blockActionButtons } from './video-comment-injector';
import { isContextAlive } from './context-guard';

const POLL_INTERVAL = 2000;
const SUPPORTED_PLATFORMS = ['tiktok', 'instagram', 'facebook', 'twitter'];

export function initActionBlocker(platform: string): () => void {
  if (!SUPPORTED_PLATFORMS.includes(platform)) return () => {};

  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick() {
    if (!isContextAlive()) { cleanup(); return; }
    try {
      const settings = await getSettings();
      if (settings.mode !== 'child' || !settings.videoControls.childBlockActions) return;
      const platforms = settings.videoControls.childBlockActionsPlatforms;
      if (!platforms?.[platform as keyof BlockActionsPlatforms]) return;
      blockActionButtons(platform);
    } catch {
      // Non-critical — action blocking failure should never break anything
    }
  }

  // Run immediately
  tick();

  // Poll for dynamically loaded content
  timer = setInterval(tick, POLL_INTERVAL);

  function cleanup() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  return cleanup;
}
