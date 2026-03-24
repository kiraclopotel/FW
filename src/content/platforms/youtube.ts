// FeelingWise - YouTube platform adapter
// Extracts text from comments, community posts, and video descriptions.

import { PostContent, FeedSource } from '../../types/post';
import { PlatformAdapter } from './adapter';
import { extractTextWithFallback, queryWithFallback } from './selector-chain';

export class YoutubeAdapter implements PlatformAdapter {
  readonly platform = 'youtube' as const;

  detectPlatform(): boolean {
    return window.location.hostname.includes('youtube.com');
  }

  getPostSelector(): string {
    return 'ytd-comment-renderer, ytd-backstage-post-renderer';
  }

  extractPosts(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];
    const feedSource = this._detectFeedSource();

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      // A. Comments
      this._extractComments(node, feedSource, posts);

      // B. Community posts
      this._extractCommunityPosts(node, feedSource, posts);

      // C. Video descriptions (watch pages only)
      this._extractDescription(node, feedSource, posts);
    });

    return posts;
  }

  replaceContent(domRef: WeakRef<HTMLElement>, newText: string): void {
    const el = domRef.deref();
    if (!el) return;

    try {
      el.dataset.fwOriginal = el.innerHTML;
      el.textContent = newText;
      el.dataset.fwNeutralized = 'true';
    } catch {
      // failures pass through unchanged
    }
  }

  private _extractComments(
    root: HTMLElement,
    feedSource: FeedSource,
    posts: PostContent[],
  ): void {
    const containers = this._collectContainers(root, 'ytd-comment-renderer');

    for (const container of containers) {
      if (container.dataset.fwProcessed) continue;

      const result = extractTextWithFallback(
        container,
        ['#content-text', '#content-text .yt-core-attributed-string', '#content-text span'],
        20,
        'yt-comment',
      );
      if (!result) continue;

      const authorEl = queryWithFallback(container, ['#author-text span', '#author-text'], 'yt-comment-author');
      const author = authorEl?.textContent?.trim() ?? 'unknown';

      const id = this._extractCommentId(container);

      posts.push({
        id,
        text: result.text,
        author,
        timestamp: new Date().toISOString(),
        platform: 'youtube',
        domRef: new WeakRef(result.element),
        feedSource,
        sourceUrl: this._extractCommentUrl(container),
      });
    }
  }

  private _extractCommunityPosts(
    root: HTMLElement,
    feedSource: FeedSource,
    posts: PostContent[],
  ): void {
    const containers = this._collectContainers(root, 'ytd-backstage-post-renderer');

    for (const container of containers) {
      if (container.dataset.fwProcessed) continue;

      const result = extractTextWithFallback(
        container,
        ['#content-text yt-attributed-string', '#content-text', '#content-text span'],
        20,
        'yt-community',
      );
      if (!result) continue;

      const authorEl = queryWithFallback(container, ['#author-text'], 'yt-community-author');
      const author = authorEl?.textContent?.trim() ?? 'unknown';

      const id = this._extractCommunityPostId(container);

      posts.push({
        id,
        text: result.text,
        author,
        timestamp: new Date().toISOString(),
        platform: 'youtube',
        domRef: new WeakRef(result.element),
        feedSource,
        sourceUrl: this._extractCommunityPostUrl(container),
      });
    }
  }

  private _extractDescription(
    root: HTMLElement,
    feedSource: FeedSource,
    posts: PostContent[],
  ): void {
    if (!window.location.pathname.startsWith('/watch')) return;

    const containers = this._collectContainers(root, 'ytd-watch-metadata');
    const expanderContainers = this._collectContainers(root, 'ytd-expander');
    const allContainers = [...containers, ...expanderContainers];

    for (const container of allContainers) {
      if (container.dataset.fwProcessed) continue;
      if (container.dataset.fwDescProcessed) continue;

      const result = extractTextWithFallback(
        container,
        [
          '#description-inline-expander yt-attributed-string',
          '#description-inner yt-attributed-string',
          'ytd-text-inline-expander span',
        ],
        20,
        'yt-description',
      );
      if (!result) continue;

      const authorEl = queryWithFallback(
        container,
        ['a.yt-simple-endpoint', '#channel-name'],
        'yt-desc-author',
      );
      const author = authorEl?.textContent?.trim() ?? 'unknown';

      const videoId = this._extractVideoId();

      container.dataset.fwDescProcessed = 'true';

      posts.push({
        id: videoId,
        text: result.text,
        author,
        timestamp: new Date().toISOString(),
        platform: 'youtube',
        domRef: new WeakRef(result.element),
        feedSource,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  }

  private _collectContainers(root: HTMLElement, selector: string): HTMLElement[] {
    const results: HTMLElement[] = [];

    if (root.matches?.(selector)) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>(selector).forEach((el) => results.push(el));

    return results;
  }

  private _extractCommentId(container: Element): string {
    // Try id attribute
    const id = container.getAttribute('id');
    if (id) return id;

    // Try link with &lc= parameter
    const link = container.querySelector<HTMLAnchorElement>('a[href*="&lc="]');
    if (link) {
      const match = link.href.match(/[&?]lc=([^&]+)/);
      if (match) return match[1];
    }

    return crypto.randomUUID();
  }

  private _extractCommunityPostId(container: Element): string {
    const link = container.querySelector<HTMLAnchorElement>('a[href*="/post/"]');
    if (link) {
      const match = link.href.match(/\/post\/([^/?]+)/);
      if (match) return match[1];
    }

    return crypto.randomUUID();
  }

  private _extractCommentUrl(container: Element): string {
    const link = container.querySelector<HTMLAnchorElement>('a[href*="lc="]');
    if (!link?.href) return '';
    return link.href;
  }

  private _extractCommunityPostUrl(container: Element): string {
    const link = container.querySelector<HTMLAnchorElement>('a[href*="/post/"]');
    return link?.href ?? '';
  }

  private _extractVideoId(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get('v') ?? crypto.randomUUID();
  }

  private _detectFeedSource(): FeedSource {
    const path = window.location.pathname;
    if (path === '/' || path === '/feed/trending') return 'for-you';
    if (path.startsWith('/results')) return 'search';
    if (path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/')) return 'profile';
    if (path.startsWith('/watch')) return 'unknown';
    if (path.startsWith('/shorts/')) return 'for-you';
    return 'unknown';
  }
}
