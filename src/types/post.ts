// FeelingWise - Post content types
// Standardized format produced by platform adapters

export interface PostContent {
  id: string;
  text: string;
  author: string;
  timestamp: string;             // ISO-8601
  platform: Platform;
  domRef: WeakRef<HTMLElement>;
  mediaUrls?: string[];
}

export type Platform = 'twitter' | 'instagram' | 'tiktok' | 'facebook' | 'youtube';
