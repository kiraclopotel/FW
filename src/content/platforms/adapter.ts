// FeelingWise - Platform adapter base interface
// All platform adapters implement this contract

import { PostContent, Platform } from "@types/post";

export interface PlatformAdapter {
  platform: Platform;
  detectPlatform(): boolean;
  extractPosts(nodes: NodeList): PostContent[];
  replaceContent(domRef: WeakRef<HTMLElement>, newText: string): void;
  getPostSelector(): string;
}
