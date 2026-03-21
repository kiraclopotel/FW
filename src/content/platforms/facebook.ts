// FeelingWise - Facebook platform adapter
// Extracts post text via div[role="article"] selector

import { PostContent, FeedSource } from '../../types/post';
import { PlatformAdapter } from './adapter';
import { extractTextWithFallback } from './selector-chain';

export class FacebookAdapter implements PlatformAdapter {
  readonly platform = 'facebook' as const;

  detectPlatform(): boolean {
    return window.location.hostname.includes('facebook.com');
  }

  getPostSelector(): string {
    return 'div[role="article"]';
  }

  extractPosts(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];
    const feedSource = this._detectFeedSource();

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const articles = this._collectArticles(node);

      for (const article of articles) {
        if (article.dataset.fwProcessed) continue;

        const result = this._extractText(article);
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
          platform: 'facebook',
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
      const originalHtml = el.innerHTML;
      el.dataset.fwOriginal = originalHtml;
      el.textContent = newText;
      el.dataset.fwNeutralized = 'true';
    } catch {
      // Consistency rule 13: failures pass through unchanged
    }
  }

  private _collectArticles(root: HTMLElement): HTMLElement[] {
    const results: HTMLElement[] = [];

    if (root.matches?.('div[role="article"]')) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>('div[role="article"]').forEach(
      (el) => results.push(el)
    );

    return results;
  }

  private _extractText(article: HTMLElement): { element: HTMLElement; text: string } | null {
    // First try selector-chain utility for ad previews
    const adResult = extractTextWithFallback(
      article,
      ['div[data-ad-preview="message"]'],
      20,
      'facebook-text',
    );
    if (adResult) return adResult;

    // Fallback: manual search with comment/nested filtering
    return this._extractTextElement(article);
  }

  private _isInCommentOrNested(el: HTMLElement, article: HTMLElement): boolean {
    let current: HTMLElement | null = el.parentElement;
    while (current && current !== article) {
      // Inside a comment section
      if (current.tagName === 'UL') return true;
      // Inside a nested shared article
      if (current.getAttribute('role') === 'article') return true;
      // Inside complementary content
      if (current.getAttribute('role') === 'complementary') return true;
      current = current.parentElement;
    }
    return false;
  }

  private _extractTextElement(article: HTMLElement): { element: HTMLElement; text: string } | null {
    const candidates = article.querySelectorAll<HTMLElement>('div[dir="auto"]');
    let best: HTMLElement | null = null;
    let bestLen = 0;

    for (const el of candidates) {
      if (this._isInCommentOrNested(el, article)) continue;

      const text = el.textContent?.trim() ?? '';
      if (text.length > 20 && text.length > bestLen) {
        best = el;
        bestLen = text.length;
      }
    }

    if (!best) return null;
    return { element: best, text: best.textContent?.trim() ?? '' };
  }

  private _extractAuthor(article: HTMLElement): string {
    // Strategy 1: strong tag inside a link (common Facebook pattern for author names)
    const strongLink = article.querySelector<HTMLElement>('a[role="link"] strong');
    if (strongLink?.textContent?.trim()) {
      return strongLink.textContent.trim();
    }

    // Strategy 2: first link in header area with a user-like href
    const links = article.querySelectorAll<HTMLAnchorElement>('a[role="link"]');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      // Match profile URLs: /username or /profile.php?id=
      if (href.match(/^\/[a-zA-Z0-9.]+\/?$/) || href.includes('/profile.php?id=')) {
        const text = link.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) {
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

      // /posts/ID
      const postMatch = href.match(/\/posts\/(\w+)/);
      if (postMatch) return postMatch[1];

      // /permalink/ID
      const permalinkMatch = href.match(/\/permalink\/(\w+)/);
      if (permalinkMatch) return permalinkMatch[1];

      // story_fbid parameter
      const storyMatch = href.match(/story_fbid=(\d+)/);
      if (storyMatch) return storyMatch[1];

      // /reel/ID
      const reelMatch = href.match(/\/reel\/(\d+)/);
      if (reelMatch) return reelMatch[1];
    }
    return null;
  }

  private _detectFeedSource(): FeedSource {
    const path = window.location.pathname;
    if (path.includes('/groups/')) return 'following';
    if (path.includes('/watch')) return 'for-you';
    if (path.includes('/profile') || path.match(/^\/[a-zA-Z0-9.]+\/?$/)) return 'profile';
    if (path === '/' || path === '/home' || path === '') return 'unknown';
    return 'unknown';
  }
}
