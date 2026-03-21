// FeelingWise - Post content types
// Standardized format produced by platform adapters

export type FeedSource = 'for-you' | 'following' | 'profile' | 'search' | 'unknown';

export interface PostContent {
  id: string;
  text: string;
  author: string;
  timestamp: string;             // ISO-8601
  platform: Platform;
  domRef: WeakRef<HTMLElement>;
  mediaUrls?: string[];
  feedSource?: FeedSource;
}

export type Platform = 'twitter' | 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'reddit' | '4chan';
