// FeelingWise - Processing queue with concurrency control
// Prevents burst API calls during fast scrolling.
// Viewport-visible posts get priority over scrolled-past posts.

import { PostContent } from '../types/post';
import { PipelineResult } from '../core/pipeline';

export interface QueueItem {
  post: PostContent;
  priority: number;  // higher = process first
  addedAt: number;
}

type ProcessFn = (post: PostContent) => Promise<PipelineResult>;

const MAX_CONCURRENT = 3;
const MAX_QUEUE_SIZE = 30;
const STALE_MS = 30_000; // Drop items older than 30 seconds

export class ProcessingQueue {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private processFn: ProcessFn;
  private onResult: (post: PostContent, result: PipelineResult) => void;

  constructor(
    processFn: ProcessFn,
    onResult: (post: PostContent, result: PipelineResult) => void,
  ) {
    this.processFn = processFn;
    this.onResult = onResult;
  }

  /**
   * Add a post to the queue.
   * @param post The post content
   * @param isVisible Whether the post is currently in the viewport
   */
  enqueue(post: PostContent, isVisible: boolean): void {
    // Check if already in queue (by post ID)
    if (this.queue.some(item => item.post.id === post.id)) return;

    const item: QueueItem = {
      post,
      priority: isVisible ? 10 : 1,
      addedAt: Date.now(),
    };

    this.queue.push(item);

    // Enforce max queue size — drop lowest-priority items
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);
      this.queue = this.queue.slice(0, MAX_QUEUE_SIZE);
    }

    this._drain();
  }

  /**
   * Process items from the queue respecting concurrency limits.
   */
  private _drain(): void {
    while (this.activeCount < MAX_CONCURRENT && this.queue.length > 0) {
      // Remove stale items
      const now = Date.now();
      this.queue = this.queue.filter(item => now - item.addedAt < STALE_MS);

      if (this.queue.length === 0) break;

      // Sort by priority descending, then by age ascending (oldest first among same priority)
      this.queue.sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);

      const item = this.queue.shift()!;
      this.activeCount++;

      this.processFn(item.post)
        .then(result => {
          this.onResult(item.post, result);
        })
        .catch(err => {
          console.error('[FeelingWise] Queue processing error:', err);
        })
        .finally(() => {
          this.activeCount--;
          this._drain();
        });
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.activeCount;
  }
}
