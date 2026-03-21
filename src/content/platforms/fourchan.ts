// FeelingWise - 4chan platform adapter
// Extracts post text from .postMessage blockquotes in thread pages

import { PostContent } from '../../types/post';
import { PlatformAdapter } from './adapter';

function cleanPostText(messageEl: HTMLElement): string {
  // Clone to avoid mutating the DOM
  const clone = messageEl.cloneNode(true) as HTMLElement;

  // Remove quotelinks (>>12345) — these are just reply references
  clone.querySelectorAll('.quotelink').forEach(el => el.remove());

  // Remove dead links
  clone.querySelectorAll('.deadlink').forEach(el => el.remove());

  // Convert <br> to newlines for text extraction
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));

  // Get text and normalize whitespace
  return (clone.textContent ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .trim();
}

export class FourchanAdapter implements PlatformAdapter {
  readonly platform = '4chan' as const;

  detectPlatform(): boolean {
    const host = window.location.hostname;
    return host.includes('4chan.org') || host.includes('4channel.org');
  }

  getPostSelector(): string {
    return '.postContainer .postMessage';
  }

  extractPosts(nodes: NodeList): PostContent[] {
    const posts: PostContent[] = [];

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      const containers = this._collectPostContainers(node);

      for (const container of containers) {
        if (container.dataset.fwProcessed) continue;

        const messageEl = container.querySelector<HTMLElement>('.postMessage');
        if (!messageEl) continue;

        const text = cleanPostText(messageEl);
        if (text.length < 20) continue;

        const author = this._extractAuthor(container);
        const postId = this._extractPostId(container);

        container.dataset.fwProcessed = 'true';

        posts.push({
          id: postId,
          text,
          author,
          timestamp: new Date().toISOString(),
          platform: '4chan',
          domRef: new WeakRef(messageEl),
          feedSource: 'unknown',
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
      // failures pass through unchanged
    }
  }

  private _collectPostContainers(root: HTMLElement): HTMLElement[] {
    const results: HTMLElement[] = [];

    if (root.matches?.('.postContainer')) {
      results.push(root);
    }

    root.querySelectorAll<HTMLElement>('.postContainer').forEach(
      (el) => results.push(el)
    );

    return results;
  }

  private _extractAuthor(container: HTMLElement): string {
    const trip = container.querySelector<HTMLElement>('.postertrip');
    if (trip?.textContent?.trim()) return trip.textContent.trim();

    const name = container.querySelector<HTMLElement>('.name');
    return name?.textContent?.trim() ?? 'Anonymous';
  }

  private _extractPostId(container: HTMLElement): string {
    const id = container.id; // format: pc{number}
    if (id.startsWith('pc')) return id.slice(2);
    return crypto.randomUUID();
  }
}
