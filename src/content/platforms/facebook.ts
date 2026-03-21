// FeelingWise - Facebook platform adapter
// Extracts post text via div[role="article"] selector

import { PostContent } from '../../types/post';
import { PlatformAdapter } from './adapter';

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

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const articles = this._collectArticles(node);

      for (const article of articles) {
        if (article.dataset.fwProcessed) continue;

        const textEl = this._extractTextElement(article);
        if (!textEl) continue;

        const text = textEl.textContent?.trim() ?? '';
        if (!text || text.length < 20) continue;

        const author = this._extractAuthor(article);
        const postId = this._extractPostId(article) ?? crypto.randomUUID();

        article.dataset.fwProcessed = 'true';

        posts.push({
          id: postId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: 'facebook',
          domRef: new WeakRef(textEl),
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

  private _extractTextElement(article: HTMLElement): HTMLElement | null {
    // Prefer the ad-preview message container (reliable selector)
    const adPreview = article.querySelector<HTMLElement>('div[data-ad-preview="message"]');
    if (adPreview) return adPreview;

    // Fallback: find the deepest div[dir="auto"] with substantial text
    const candidates = article.querySelectorAll<HTMLElement>('div[dir="auto"]');
    let best: HTMLElement | null = null;
    let bestLen = 0;

    candidates.forEach((el) => {
      const text = el.textContent?.trim() ?? '';
      if (text.length > 20 && text.length > bestLen) {
        best = el;
        bestLen = text.length;
      }
    });

    return best;
  }

  private _extractAuthor(article: HTMLElement): string {
    // Author name is typically in a link with role="link" in the header area
    const authorLink = article.querySelector<HTMLAnchorElement>(
      'a[role="link"]'
    );
    return authorLink?.textContent?.trim() ?? 'unknown';
  }

  private _extractPostId(article: HTMLElement): string | null {
    // Look for links containing /posts/ or /permalink/
    const links = article.querySelectorAll<HTMLAnchorElement>('a[href]');
    for (const link of links) {
      const postMatch = link.href.match(/\/posts\/(\w+)/);
      if (postMatch) return postMatch[1];

      const permalinkMatch = link.href.match(/\/permalink\/(\w+)/);
      if (permalinkMatch) return permalinkMatch[1];
    }
    return null;
  }
}
