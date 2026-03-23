// FeelingWise - Instagram platform adapter
// Uses structural patterns (tag hierarchy, roles, attributes) instead of
// class names because Meta aggressively obfuscates them.

import { PostContent, FeedSource } from '../../types/post';
import { PlatformAdapter } from './adapter';

export class InstagramAdapter implements PlatformAdapter {
  readonly platform = 'instagram' as const;

  detectPlatform(): boolean {
    return window.location.hostname.includes('instagram.com');
  }

  getPostSelector(): string {
    return 'article';
  }

  extractPosts(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];
    const feedSource = this._detectFeedSource();

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const articles = this._collectArticles(node);

      for (const article of articles) {
        if (article.dataset.fwProcessed) continue;

        const result = this._extractTextElement(article);
        if (!result) continue;

        const { element, text } = result;

        const author = this._extractAuthor(article);
        const postId = this._extractPostId(article) ?? crypto.randomUUID();

        article.dataset.fwProcessed = 'true';

        posts.push({
          id: postId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: 'instagram',
          domRef: new WeakRef(element),
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
      el.dataset.fwOriginal = el.innerHTML;
      // Replace text nodes only, preserving child elements (author links, etc.)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      if (textNodes.length > 0) {
        textNodes[0].textContent = newText;
        for (let i = 1; i < textNodes.length; i++) {
          textNodes[i].textContent = '';
        }
      } else {
        el.textContent = newText;
      }
      el.dataset.fwNeutralized = 'true';
    } catch {
      // Consistency rule 13: failures pass through unchanged
    }
  }

  private _collectArticles(root: HTMLElement): HTMLElement[] {
    const results: HTMLElement[] = [];

    if (root.matches?.('article')) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>('article').forEach(
      (el) => results.push(el)
    );

    return results;
  }

  private _extractTextElement(article: HTMLElement): { element: HTMLElement; text: string } | null {
    const spans = article.querySelectorAll<HTMLElement>('span[dir="auto"]');

    let best: HTMLElement | null = null;
    let bestLen = 0;

    for (const span of spans) {
      // Skip if inside comments (ul elements)
      if (span.closest('ul')) continue;

      // Skip if inside a button (like/share/etc)
      if (span.closest('button')) continue;

      // Skip if it looks like a timestamp or metadata
      const text = span.textContent?.trim() ?? '';
      if (text.length < 20) continue;

      // Prefer the longest qualifying span (caption is usually longest)
      if (text.length > bestLen) {
        best = span;
        bestLen = text.length;
      }
    }

    if (!best) return null;
    return { element: best, text: best.textContent?.trim() ?? '' };
  }

  private _extractAuthor(article: HTMLElement): string {
    const links = article.querySelectorAll<HTMLAnchorElement>('a[href][role="link"]');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      // Match /username/ pattern (1-30 chars, alphanumeric + dots + underscores)
      if (/^\/[a-zA-Z0-9_.]{1,30}\/$/.test(href)) {
        const text = link.textContent?.trim();
        if (text && text.length > 0 && text.length < 40) {
          return text;
        }
      }
    }
    return 'unknown';
  }

  private _extractPostId(article: HTMLElement): string | null {
    const links = article.querySelectorAll<HTMLAnchorElement>('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      const postMatch = href.match(/\/p\/([A-Za-z0-9_-]+)/);
      if (postMatch) return postMatch[1];
      const reelMatch = href.match(/\/reel\/([A-Za-z0-9_-]+)/);
      if (reelMatch) return reelMatch[1];
    }
    return null;
  }

  private _detectFeedSource(): FeedSource {
    const path = window.location.pathname;
    if (path === '/' || path === '') return 'for-you';
    if (path.startsWith('/explore')) return 'for-you';
    if (path.includes('/p/') || path.includes('/reel/')) return 'unknown';
    if (/^\/[a-zA-Z0-9_.]{1,30}\/?$/.test(path)) return 'profile';
    return 'unknown';
  }
}
