// FeelingWise - Core interception logic
// Watches for new DOM nodes via MutationObserver, routes to the active adapter
// for post extraction, then marks nodes with data-fw-processed.
//
// Phase 2: extraction only — no detection pipeline yet.
// Posts are logged to console to prove interception works.

import { PostContent } from '../types/post';
import { PlatformAdapter } from './platforms/adapter';

export type PostHandler = (post: PostContent) => void;

export class ContentInterceptor {
  private observer: MutationObserver | null = null;
  private adapter: PlatformAdapter;
  private onPost: PostHandler;

  constructor(adapter: PlatformAdapter, onPost: PostHandler) {
    this.adapter = adapter;
    this.onPost = onPost;
  }

  /**
   * Start observing the document for new posts.
   * MutationObserver with subtree:true handles Twitter's infinite scroll.
   */
  start(): void {
    if (this.observer) return; // already running

    // Process any posts already present in the DOM on load
    this._processNodes(document.body.childNodes);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          this._processNodes(mutation.addedNodes);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private _processNodes(nodes: NodeList): void {
    const posts = this.adapter.extractPosts(nodes);

    for (const post of posts) {
      // Mark the DOM element as processed so we don't re-process on re-render
      const el = post.domRef.deref();
      if (el) {
        el.dataset.fwProcessed = 'true';
      }

      this.onPost(post);
    }
  }
}
