// FeelingWise - Platform adapter base interface
// All platform adapters implement this contract

import { PostContent, Platform } from '../../types/post';

export interface PlatformAdapter {
  platform: Platform;
  detectPlatform(): boolean;
  extractPosts(nodes: NodeList): PostContent[];
  replaceContent(domRef: WeakRef<HTMLElement>, newText: string): void;
  getPostSelector(): string;
}

/**
 * Detect which platform the current page is on.
 * Returns null if not on a supported platform.
 */
export function detectCurrentPlatform(): Platform | null {
  const host = window.location.hostname;
  if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('tiktok.com')) return 'tiktok';
  if (host.includes('facebook.com')) return 'facebook';
  if (host.includes('youtube.com')) return 'youtube';
  return null;
}
