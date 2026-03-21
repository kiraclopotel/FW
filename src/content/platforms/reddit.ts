// FeelingWise - Reddit platform adapter
// Handles both New Reddit (shreddit web components) and Old Reddit (traditional HTML)

import { PostContent, FeedSource } from '../../types/post';
import { PlatformAdapter } from './adapter';
import { extractTextWithFallback } from './selector-chain';

export class RedditAdapter implements PlatformAdapter {
  readonly platform = 'reddit' as const;

  detectPlatform(): boolean {
    return window.location.hostname.includes('reddit.com');
  }

  getPostSelector(): string {
    if (this._isOldReddit()) {
      return '.thing.link, .comment';
    }
    return 'shreddit-post, shreddit-comment';
  }

  extractPosts(nodes: NodeList): PostContent[] {
    if (this._isOldReddit()) {
      return this._extractOldReddit(nodes);
    }
    return this._extractNewReddit(nodes);
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

  private _isOldReddit(): boolean {
    return window.location.hostname === 'old.reddit.com'
      || !!document.querySelector('.thing.link');
  }

  private _extractNewReddit(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];
    const feedSource = this._detectFeedSource();

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const elements = this._collectNewRedditNodes(node);

      for (const el of elements) {
        if (el.dataset.fwProcessed) continue;

        const post = this._extractNewRedditPost(el, feedSource);
        if (post) {
          el.dataset.fwProcessed = 'true';
          posts.push(post);
        }
      }
    });

    return posts;
  }

  private _collectNewRedditNodes(root: HTMLElement): HTMLElement[] {
    const results: HTMLElement[] = [];
    const tagLower = root.tagName?.toLowerCase();

    if (tagLower === 'shreddit-post' || tagLower === 'shreddit-comment') {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>('shreddit-post, shreddit-comment').forEach(
      (el) => results.push(el),
    );

    return results;
  }

  private _extractNewRedditPost(el: HTMLElement, feedSource: FeedSource): PostContent | null {
    const tagLower = el.tagName?.toLowerCase();

    if (tagLower === 'shreddit-post') {
      return this._extractNewRedditShredditPost(el, feedSource);
    }

    if (tagLower === 'shreddit-comment') {
      return this._extractNewRedditShredditComment(el, feedSource);
    }

    return null;
  }

  private _extractNewRedditShredditPost(el: HTMLElement, feedSource: FeedSource): PostContent | null {
    const author = el.getAttribute('author') ?? 'unknown';
    const postId = el.getAttribute('id') ?? crypto.randomUUID();

    // Try self-text body first
    const textBody = el.querySelector<HTMLElement>('[slot="text-body"]');
    if (textBody) {
      const text = textBody.textContent?.trim() ?? '';
      if (text.length >= 20) {
        return {
          id: postId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: 'reddit',
          domRef: new WeakRef(textBody),
          feedSource,
        };
      }
    }

    // Fall back to title
    const titleEl = el.querySelector<HTMLElement>('a[slot="title"], [slot="title"]');
    if (titleEl) {
      const text = titleEl.textContent?.trim() ?? '';
      if (text.length >= 20) {
        return {
          id: postId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: 'reddit',
          domRef: new WeakRef(titleEl),
          feedSource,
        };
      }
    }

    return null;
  }

  private _extractNewRedditShredditComment(el: HTMLElement, feedSource: FeedSource): PostContent | null {
    const author = el.getAttribute('author') ?? 'unknown';
    const postId = el.getAttribute('thingid') ?? crypto.randomUUID();

    // Try shadow DOM first, then light DOM
    let textEl: HTMLElement | null = null;
    let text = '';

    const shadowMd = (el as any).shadowRoot?.querySelector('div.md') as HTMLElement | null;
    if (shadowMd) {
      textEl = shadowMd;
      text = shadowMd.textContent?.trim() ?? '';
    }

    if (!textEl || text.length < 20) {
      const result = extractTextWithFallback(
        el,
        ['[slot="comment"]', 'div.md'],
        20,
        'reddit-comment',
      );
      if (result) {
        textEl = result.element;
        text = result.text;
      }
    }

    if (!textEl || text.length < 20) return null;

    return {
      id: postId,
      text,
      author,
      timestamp: new Date().toISOString(),
      platform: 'reddit',
      domRef: new WeakRef(textEl),
      feedSource,
    };
  }

  private _extractOldReddit(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];
    const feedSource = this._detectFeedSource();

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const elements = this._collectOldRedditNodes(node);

      for (const el of elements) {
        if (el.dataset.fwProcessed) continue;

        const post = this._extractOldRedditElement(el, feedSource);
        if (post) {
          el.dataset.fwProcessed = 'true';
          posts.push(post);
        }
      }
    });

    return posts;
  }

  private _collectOldRedditNodes(root: HTMLElement): HTMLElement[] {
    const results: HTMLElement[] = [];
    const selector = '.thing.link, div.thing[data-fullname^="t3_"], .comment, div.thing[data-fullname^="t1_"]';

    if (root.matches?.(selector)) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>(selector).forEach(
      (el) => results.push(el),
    );

    return results;
  }

  private _extractOldRedditElement(el: HTMLElement, feedSource: FeedSource): PostContent | null {
    const author = el.getAttribute('data-author') ?? 'unknown';
    const postId = this._extractOldRedditId(el);
    const isComment = el.classList.contains('comment') || el.getAttribute('data-fullname')?.startsWith('t1_');

    if (isComment) {
      const result = extractTextWithFallback(el, ['.usertext-body .md'], 20, 'old-reddit-comment');
      if (!result) return null;
      return {
        id: postId,
        text: result.text,
        author,
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        domRef: new WeakRef(result.element),
        feedSource,
      };
    }

    // Post: try self-text first, then title
    const selfText = extractTextWithFallback(el, ['.usertext-body .md'], 20, 'old-reddit-selftext');
    if (selfText) {
      return {
        id: postId,
        text: selfText.text,
        author,
        timestamp: new Date().toISOString(),
        platform: 'reddit',
        domRef: new WeakRef(selfText.element),
        feedSource,
      };
    }

    const titleEl = el.querySelector<HTMLElement>('a.title');
    if (titleEl) {
      const text = titleEl.textContent?.trim() ?? '';
      if (text.length >= 20) {
        return {
          id: postId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: 'reddit',
          domRef: new WeakRef(titleEl),
          feedSource,
        };
      }
    }

    return null;
  }

  private _extractOldRedditId(el: HTMLElement): string {
    const fullname = el.getAttribute('data-fullname');
    if (fullname) return fullname;

    const id = el.getAttribute('id') ?? '';
    const match = id.match(/^thing_(t[13]_\w+)$/);
    if (match) return match[1];

    return crypto.randomUUID();
  }

  private _detectFeedSource(): FeedSource {
    try {
      const path = window.location.pathname;
      if (path === '/' || path === '/best' || path === '/hot' || path === '/new' || path === '/top') return 'for-you';
      if (path.startsWith('/r/') && !path.includes('/comments/')) return 'following';
      if (path.startsWith('/r/') && path.includes('/comments/')) return 'profile';
      if (path.startsWith('/user/') || path.startsWith('/u/')) return 'profile';
      if (path.startsWith('/search')) return 'search';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
