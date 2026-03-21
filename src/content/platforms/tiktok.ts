// FeelingWise - TikTok platform adapter
// Extracts caption and comment text via data-e2e selectors

import { PostContent, FeedSource } from '../../types/post';
import { PlatformAdapter } from './adapter';

export class TiktokAdapter implements PlatformAdapter {
  readonly platform = 'tiktok' as const;

  detectPlatform(): boolean {
    return window.location.hostname.includes('tiktok.com');
  }

  getPostSelector(): string {
    return '[data-e2e="browse-video-desc"], [data-e2e="video-desc"], [data-e2e="comment-level-1"]';
  }

  extractPosts(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];
    const feedSource = this._detectFeedSource();

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const items = this._collectContentNodes(node);

      for (const item of items) {
        if (item.element.dataset.fwProcessed) continue;

        const text = item.text.trim();
        if (text.length < 30) continue;

        item.element.dataset.fwProcessed = 'true';

        posts.push({
          id: item.id,
          text,
          author: item.author,
          timestamp: new Date().toISOString(),
          platform: 'tiktok',
          domRef: new WeakRef(item.element),
          feedSource,
        });
      }
    });

    return posts;
  }

  replaceContent(domRef: WeakRef<HTMLElement>, newText: string): void {
    const el = domRef.deref();
    if (!el) return;

    try {
      const originalHtml = el.innerHTML;
      el.dataset.fwOriginal = originalHtml;
      el.textContent = newText;
      el.dataset.fwNeutralized = 'true';
    } catch {
      // Consistency rule 13: failures pass through unchanged
    }
  }

  private _collectContentNodes(root: HTMLElement): Array<{
    element: HTMLElement;
    text: string;
    author: string;
    id: string;
  }> {
    const results: Array<{ element: HTMLElement; text: string; author: string; id: string }> = [];

    // A. Feed captions (For You / browse page)
    this._collectFeedCaptions(root, results);

    // B. Video detail page caption
    this._collectDetailCaptions(root, results);

    // C. Comments
    this._collectComments(root, results);

    return results;
  }

  private _collectFeedCaptions(
    root: HTMLElement,
    results: Array<{ element: HTMLElement; text: string; author: string; id: string }>,
  ): void {
    const descNodes = this._findElements(root, '[data-e2e="browse-video-desc"]');

    for (const descEl of descNodes) {
      const container =
        descEl.closest('[data-e2e="recommend-list-item-container"]') ??
        descEl.parentElement;
      if (!container || (container as HTMLElement).dataset?.fwProcessed) continue;

      const text = descEl.textContent?.trim() ?? '';
      const author = this._extractFeedAuthor(container as HTMLElement);
      const id = this._extractVideoId(container as HTMLElement) ?? crypto.randomUUID();

      results.push({ element: descEl, text, author, id });
    }
  }

  private _collectDetailCaptions(
    root: HTMLElement,
    results: Array<{ element: HTMLElement; text: string; author: string; id: string }>,
  ): void {
    const detailDescs = this._findElements(root, '[data-e2e="video-desc"]');

    for (const descEl of detailDescs) {
      // Skip if this was already collected as a feed caption
      if (descEl.closest('[data-e2e="browse-video-desc"]')) continue;
      if (descEl.matches('[data-e2e="browse-video-desc"]')) continue;

      const container =
        descEl.closest('[data-e2e="video-detail"]') ??
        descEl.parentElement;
      if (!container || (container as HTMLElement).dataset?.fwProcessed) continue;

      const text = descEl.textContent?.trim() ?? '';
      const author = this._extractDetailAuthor(container as HTMLElement);
      const id = this._extractVideoId(container as HTMLElement) ?? this._extractVideoIdFromUrl() ?? crypto.randomUUID();

      results.push({ element: descEl, text, author, id });
    }
  }

  private _collectComments(
    root: HTMLElement,
    results: Array<{ element: HTMLElement; text: string; author: string; id: string }>,
  ): void {
    const commentNodes = this._findElements(root, '[data-e2e="comment-level-1"]');

    for (const commentEl of commentNodes) {
      if (commentEl.dataset.fwProcessed) continue;

      const textEl =
        commentEl.querySelector<HTMLElement>('[data-e2e="comment-text-1"] span') ??
        commentEl.querySelector<HTMLElement>('[data-e2e="comment-text-1"]');
      if (!textEl) continue;

      const text = textEl.textContent?.trim() ?? '';
      const authorEl = commentEl.querySelector<HTMLElement>('[data-e2e="comment-username-1"]');
      const author = authorEl?.textContent?.trim() ?? 'unknown';
      const id = crypto.randomUUID();

      results.push({ element: commentEl, text, author, id });
    }
  }

  private _findElements(root: HTMLElement, selector: string): HTMLElement[] {
    const results: HTMLElement[] = [];

    if (root.matches?.(selector)) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>(selector).forEach((el) => results.push(el));

    return results;
  }

  private _extractFeedAuthor(container: HTMLElement): string {
    const browseUsername = container.querySelector<HTMLElement>('[data-e2e="browse-username"]');
    if (browseUsername?.textContent?.trim()) {
      return browseUsername.textContent.trim();
    }

    const profileLink = container.querySelector<HTMLAnchorElement>('a[href^="/@"]');
    if (profileLink?.textContent?.trim()) {
      return profileLink.textContent.trim();
    }

    return 'unknown';
  }

  private _extractDetailAuthor(container: HTMLElement): string {
    const authorEl = container.querySelector<HTMLElement>('[data-e2e="video-author-uniqueid"]');
    if (authorEl?.textContent?.trim()) {
      return authorEl.textContent.trim();
    }

    const profileLink = container.querySelector<HTMLAnchorElement>('a[href^="/@"]');
    if (profileLink?.textContent?.trim()) {
      return profileLink.textContent.trim();
    }

    return 'unknown';
  }

  private _extractVideoId(container: HTMLElement): string | null {
    const links = container.querySelectorAll<HTMLAnchorElement>('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      const match = href.match(/\/video\/(\d+)/);
      if (match) return match[1];
    }
    return null;
  }

  private _extractVideoIdFromUrl(): string | null {
    const match = window.location.pathname.match(/\/video\/(\d+)/);
    return match?.[1] ?? null;
  }

  private _detectFeedSource(): FeedSource {
    const path = window.location.pathname;
    if (path === '/' || path === '/foryou' || path.startsWith('/for-you')) return 'for-you';
    if (path.startsWith('/following')) return 'following';
    if (path.startsWith('/@')) return 'profile';
    if (path.startsWith('/search') || path.startsWith('/tag/')) return 'search';
    return 'unknown';
  }
}
