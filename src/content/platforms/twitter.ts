// FeelingWise - Twitter/X platform adapter
// Extracts tweet text via [data-testid="tweetText"] selector

import { PostContent } from '../../types/post';
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

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const tweetNodes = this._collectTweetNodes(node);

      for (const tweetEl of tweetNodes) {
        // Skip already-processed nodes
        if (tweetEl.dataset.fwProcessed) continue;

        const text = tweetEl.textContent?.trim() ?? '';
        if (!text) continue;

        const article = tweetEl.closest('article');
        const author = this._extractAuthor(article);
        const tweetId = this._extractTweetId(article) ?? crypto.randomUUID();

        posts.push({
          id: tweetId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: 'twitter',
          domRef: new WeakRef(tweetEl),
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

  private _collectTweetNodes(root: HTMLElement): HTMLElement[] {
    const results: HTMLElement[] = [];

    if (root.matches?.('[data-testid="tweetText"]')) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>('[data-testid="tweetText"]').forEach(
      (el) => results.push(el)
    );

    return results;
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
}
