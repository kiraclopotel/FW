// FeelingWise - Twitter/X platform adapter
// Extracts tweet text via [data-testid="tweetText"] selector

import { PostContent, FeedSource } from '../../types/post';
import { PlatformAdapter } from './adapter';

export class TwitterAdapter implements PlatformAdapter {
  readonly platform = 'twitter' as const;

  detectPlatform(): boolean {
    const host = window.location.hostname;
    return host.includes('twitter.com') || host.includes('x.com');
  }

  getPostSelector(): string {
    return '[data-testid="tweetText"]';
  }

  extractPosts(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];
    const feedSource = this._detectFeedSource();

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const tweetNodes = this._collectTweetNodes(node);

      for (const tweetEl of tweetNodes) {
        // Skip already-processed nodes
        if (tweetEl.dataset.fwProcessed) continue;

        const text = tweetEl.textContent?.trim() ?? '';
        if (!text) continue;

        const article = tweetEl.closest('article');
        const author = this._extractHandle(article) ?? this._extractAuthor(article);
        const tweetId = this._extractTweetId(article) ?? crypto.randomUUID();

        posts.push({
          id: tweetId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: 'twitter',
          domRef: new WeakRef(tweetEl),
          feedSource,
        });
      }
    });

    return posts;
  }

  extractFollowState(article: Element | null): 'following' | 'not-following' | 'unknown' {
    if (!article) return 'unknown';
    try {
      const unfollowBtn = article.querySelector('[data-testid$="-unfollow"]');
      if (unfollowBtn) return 'following';
      const followBtn = article.querySelector('[data-testid$="-follow"]');
      if (followBtn) return 'not-following';
      return 'unknown';
    } catch {
      return 'unknown';
    }
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

  private _collectTweetNodes(root: HTMLElement): HTMLElement[] {
    const results: HTMLElement[] = [];

    if (root.matches?.('[data-testid="tweetText"]')) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>('[data-testid="tweetText"]').forEach(
      (el) => results.push(el)
    );

    // Filter out nested tweetText elements (quote tweets)
    return results.filter(el => {
      let parent = el.parentElement;
      while (parent && parent !== root) {
        if (parent.matches?.('[data-testid="tweetText"]')) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }

  private _extractHandle(article: Element | null): string | null {
    if (!article) return null;
    // Twitter articles contain profile links like href="/RealAlexJones"
    const links = article.querySelectorAll<HTMLAnchorElement>('a[href^="/"][role="link"]');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      if (/^\/[A-Za-z0-9_]+$/.test(href)) {
        return href.slice(1); // strip leading /
      }
    }
    return null;
  }

  private _extractAuthor(article: Element | null): string {
    if (!article) return 'unknown';
    const userLink = article.querySelector<HTMLAnchorElement>(
      'a[href^="/"][role="link"] span'
    );
    return userLink?.textContent?.trim() ?? 'unknown';
  }

  private _extractTweetId(article: Element | null): string | null {
    if (!article) return null;
    const statusLink = article.querySelector<HTMLAnchorElement>(
      'a[href*="/status/"]'
    );
    if (!statusLink) return null;
    const match = statusLink.href.match(/\/status\/(\d+)/);
    return match?.[1] ?? null;
  }

  private _detectFeedSource(): FeedSource {
    try {
      const path = window.location.pathname;
      if (path.includes('/search')) return 'search';
      if (path.includes('/status/')) return 'profile';
      if (path === '/home' || path === '/') {
        // Check active tab text to distinguish "For you" vs "Following"
        const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
        const tabText = activeTab?.textContent?.toLowerCase() ?? '';
        if (tabText.includes('following')) return 'following';
        if (tabText.includes('for you')) return 'for-you';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
