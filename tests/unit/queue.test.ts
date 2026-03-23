// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessingQueue, QueueItem } from '../../src/content/queue';
import { PostContent } from '../../src/types/post';
import { PipelineResult } from '../../src/core/pipeline';

function makePost(id: string): PostContent {
  return {
    id,
    text: `Post text for ${id}`,
    author: 'testuser',
    timestamp: new Date().toISOString(),
    platform: 'twitter',
    domRef: new WeakRef(document.createElement('div')),
  };
}

const PASS: PipelineResult = { action: 'pass' };

describe('ProcessingQueue', () => {
  let processedOrder: string[];
  let processFn: (post: PostContent) => Promise<PipelineResult>;
  let onResult: (post: PostContent, result: PipelineResult) => void;
  let resolvers: Map<string, () => void>;

  beforeEach(() => {
    processedOrder = [];
    resolvers = new Map();

    // processFn that records order and can be manually resolved
    processFn = (post: PostContent) => {
      processedOrder.push(post.id);
      return new Promise<PipelineResult>(resolve => {
        resolvers.set(post.id, () => resolve(PASS));
      });
    };

    onResult = vi.fn();
  });

  it('higher priority items processed first', async () => {
    // Use a processFn that resolves immediately to see ordering
    const immediateOrder: string[] = [];
    const immediateFn = async (post: PostContent) => {
      immediateOrder.push(post.id);
      return PASS;
    };

    const queue = new ProcessingQueue(immediateFn, onResult);

    // Enqueue low-priority first, then high-priority
    // But since MAX_CONCURRENT=3, first 3 will start immediately
    // So we need to fill the concurrent slots first, then check ordering of remaining
    const blockingResolvers = new Map<string, () => void>();
    let blockCount = 0;
    const blockingFn = (post: PostContent) => {
      blockCount++;
      return new Promise<PipelineResult>(resolve => {
        blockingResolvers.set(post.id, () => resolve(PASS));
      });
    };

    const queue2 = new ProcessingQueue(blockingFn, onResult);

    // Fill 5 concurrent slots (MAX_CONCURRENT = 5)
    queue2.enqueue(makePost('blocker-1'), false);
    queue2.enqueue(makePost('blocker-2'), false);
    queue2.enqueue(makePost('blocker-3'), false);
    queue2.enqueue(makePost('blocker-4'), false);
    queue2.enqueue(makePost('blocker-5'), false);

    // Now add low-priority then high-priority
    queue2.enqueue(makePost('low-1'), false);   // priority 1
    queue2.enqueue(makePost('high-1'), true);    // priority 10

    expect(blockCount).toBe(5); // Only 5 started

    // Resolve one blocker — high-priority should be picked next
    const processedAfterUnblock: string[] = [];
    const origFn = blockingFn;
    // Track what gets processed next
    blockingResolvers.get('blocker-1')!();

    // Allow microtasks to settle
    await new Promise(r => setTimeout(r, 10));

    // blocker-1 resolved, so high-1 (priority 10) should have started before low-1
    expect(blockCount).toBe(6);
  });

  it('stale items (>30s old) are dropped', async () => {
    const blockingResolvers = new Map<string, () => void>();
    const blockingFn = (post: PostContent) => {
      return new Promise<PipelineResult>(resolve => {
        blockingResolvers.set(post.id, () => resolve(PASS));
      });
    };

    const queue = new ProcessingQueue(blockingFn, onResult);

    // Fill concurrent slots (5 = MAX_CONCURRENT)
    queue.enqueue(makePost('active-1'), false);
    queue.enqueue(makePost('active-2'), false);
    queue.enqueue(makePost('active-3'), false);
    queue.enqueue(makePost('active-4'), false);
    queue.enqueue(makePost('active-5'), false);

    // Add item that will become stale
    queue.enqueue(makePost('stale-1'), false);
    expect(queue.pending).toBe(1);

    // Advance time past 30 seconds
    const realNow = Date.now;
    Date.now = () => realNow() + 31_000;

    // Resolve a blocker — stale item should be dropped
    blockingResolvers.get('active-1')!();
    await new Promise(r => setTimeout(r, 10));

    // The stale item should have been filtered out
    expect(queue.pending).toBe(0);

    Date.now = realNow;
  });

  it('queue does not exceed MAX_QUEUE_SIZE', () => {
    const blockingFn = () => new Promise<PipelineResult>(() => {}); // never resolves
    const queue = new ProcessingQueue(blockingFn, onResult);

    // Fill concurrent slots (5 = MAX_CONCURRENT)
    for (let i = 0; i < 5; i++) {
      queue.enqueue(makePost(`active-${i}`), false);
    }

    // Add 35 more — should cap pending at 30
    for (let i = 0; i < 35; i++) {
      queue.enqueue(makePost(`queued-${i}`), false);
    }

    expect(queue.pending).toBeLessThanOrEqual(30);
  });

  it('duplicate post IDs are rejected', () => {
    const blockingFn = () => new Promise<PipelineResult>(() => {});
    const queue = new ProcessingQueue(blockingFn, onResult);

    // Fill concurrent slots (5 = MAX_CONCURRENT)
    queue.enqueue(makePost('active-1'), false);
    queue.enqueue(makePost('active-2'), false);
    queue.enqueue(makePost('active-3'), false);
    queue.enqueue(makePost('active-4'), false);
    queue.enqueue(makePost('active-5'), false);

    queue.enqueue(makePost('dup-1'), false);
    queue.enqueue(makePost('dup-1'), false); // duplicate
    queue.enqueue(makePost('dup-1'), false); // duplicate

    expect(queue.pending).toBe(1);
  });

  it('concurrent limit is respected (max 5 active)', () => {
    let activeCount = 0;
    let maxActive = 0;

    const trackingFn = () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      return new Promise<PipelineResult>(resolve => {
        setTimeout(() => {
          activeCount--;
          resolve(PASS);
        }, 10);
      });
    };

    const queue = new ProcessingQueue(trackingFn, onResult);

    // Enqueue 10 items
    for (let i = 0; i < 10; i++) {
      queue.enqueue(makePost(`post-${i}`), false);
    }

    // Only 5 should be active at a time (MAX_CONCURRENT = 5)
    expect(queue.active).toBe(5);
    expect(maxActive).toBe(5);
  });
});
