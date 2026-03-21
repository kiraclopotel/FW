// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TiktokAdapter } from '../../src/content/platforms/tiktok';

/* ── DOM helpers ── */

function makeFeedItem(opts: {
  caption?: string;
  author?: string;
  videoId?: string;
}): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-e2e', 'recommend-list-item-container');

  const video = document.createElement('div');
  video.setAttribute('data-e2e', 'browse-video');

  const desc = document.createElement('div');
  desc.setAttribute('data-e2e', 'browse-video-desc');
  const span = document.createElement('span');
  span.textContent = opts.caption ?? '';
  desc.appendChild(span);
  video.appendChild(desc);

  if (opts.author) {
    const authorLink = document.createElement('a');
    authorLink.setAttribute('data-e2e', 'browse-username');
    authorLink.setAttribute('href', `/@${opts.author}`);
    authorLink.textContent = `@${opts.author}`;
    video.appendChild(authorLink);
  }

  if (opts.videoId) {
    const link = document.createElement('a');
    link.setAttribute('href', `/@someone/video/${opts.videoId}`);
    link.textContent = 'View';
    video.appendChild(link);
  }

  container.appendChild(video);
  return container;
}

function makeDetailPage(opts: {
  caption?: string;
  author?: string;
  videoId?: string;
}): HTMLElement {
  const detail = document.createElement('div');
  detail.setAttribute('data-e2e', 'video-detail');

  const desc = document.createElement('div');
  desc.setAttribute('data-e2e', 'video-desc');
  const span = document.createElement('span');
  span.textContent = opts.caption ?? '';
  desc.appendChild(span);
  detail.appendChild(desc);

  if (opts.author) {
    const authorLink = document.createElement('a');
    authorLink.setAttribute('data-e2e', 'video-author-uniqueid');
    authorLink.setAttribute('href', `/@${opts.author}`);
    authorLink.textContent = opts.author;
    detail.appendChild(authorLink);
  }

  if (opts.videoId) {
    const link = document.createElement('a');
    link.setAttribute('href', `/@someone/video/${opts.videoId}`);
    link.textContent = 'View';
    detail.appendChild(link);
  }

  return detail;
}

function makeComment(opts: {
  text?: string;
  author?: string;
}): HTMLElement {
  const item = document.createElement('div');
  item.setAttribute('data-e2e', 'comment-item');

  const level = document.createElement('div');
  level.setAttribute('data-e2e', 'comment-level-1');

  if (opts.author) {
    const authorLink = document.createElement('a');
    authorLink.setAttribute('data-e2e', 'comment-username-1');
    authorLink.setAttribute('href', `/@${opts.author}`);
    authorLink.textContent = `@${opts.author}`;
    level.appendChild(authorLink);
  }

  if (opts.text) {
    const textContainer = document.createElement('span');
    textContainer.setAttribute('data-e2e', 'comment-text-1');
    const span = document.createElement('span');
    span.textContent = opts.text;
    textContainer.appendChild(span);
    level.appendChild(textContainer);
  }

  item.appendChild(level);
  return item;
}

function makeFeedItemWithHrefAuthor(opts: {
  caption?: string;
  author?: string;
}): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-e2e', 'recommend-list-item-container');

  const desc = document.createElement('div');
  desc.setAttribute('data-e2e', 'browse-video-desc');
  const span = document.createElement('span');
  span.textContent = opts.caption ?? '';
  desc.appendChild(span);
  container.appendChild(desc);

  if (opts.author) {
    const link = document.createElement('a');
    link.setAttribute('href', `/@${opts.author}`);
    link.textContent = `@${opts.author}`;
    container.appendChild(link);
  }

  return container;
}

function toNodeList(elements: HTMLElement[]): NodeList {
  const container = document.createElement('div');
  for (const el of elements) {
    container.appendChild(el);
  }
  return container.childNodes;
}

/* ── Tests ── */

describe('TiktokAdapter', () => {
  let adapter: TiktokAdapter;

  beforeEach(() => {
    adapter = new TiktokAdapter();
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.tiktok.com', pathname: '/' },
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = '';
  });

  it('extracts caption text from browse-video-desc', () => {
    const item = makeFeedItem({
      caption: 'This is a TikTok caption that is long enough to pass the minimum length filter',
      author: 'creator1',
    });
    const posts = adapter.extractPosts(toNodeList([item]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('TikTok caption');
    expect(posts[0].platform).toBe('tiktok');
  });

  it('extracts caption text from video-desc (detail page)', () => {
    const detail = makeDetailPage({
      caption: 'This is a detail page caption that is definitely long enough to be extracted',
      author: 'detailuser',
      videoId: '7234567890123456789',
    });
    const posts = adapter.extractPosts(toNodeList([detail]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('detail page caption');
    expect(posts[0].id).toBe('7234567890123456789');
  });

  it('extracts author from browse-username', () => {
    const item = makeFeedItem({
      caption: 'A caption with enough characters to pass the thirty character minimum threshold',
      author: 'coolcreator',
    });
    const posts = adapter.extractPosts(toNodeList([item]));

    expect(posts).toHaveLength(1);
    expect(posts[0].author).toBe('@coolcreator');
  });

  it('extracts author from href="/@username" link', () => {
    const item = makeFeedItemWithHrefAuthor({
      caption: 'A caption with enough characters to pass the thirty character minimum threshold',
      author: 'fallbackuser',
    });
    const posts = adapter.extractPosts(toNodeList([item]));

    expect(posts).toHaveLength(1);
    expect(posts[0].author).toBe('@fallbackuser');
  });

  it('extracts comment text from comment-text-1', () => {
    const comment = makeComment({
      text: 'This is a comment that is long enough to pass the thirty character minimum',
      author: 'commenter1',
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('comment that is long enough');
    expect(posts[0].author).toBe('@commenter1');
  });

  it('skips already-processed elements', () => {
    const item = makeFeedItem({
      caption: 'This is a TikTok caption that is long enough to pass the minimum length filter',
      author: 'creator1',
    });
    // Mark the desc element as processed
    const desc = item.querySelector('[data-e2e="browse-video-desc"]') as HTMLElement;
    desc.dataset.fwProcessed = 'true';

    const posts = adapter.extractPosts(toNodeList([item]));
    expect(posts).toHaveLength(0);
  });

  it('skips text shorter than 30 chars (TikTok minimum is higher)', () => {
    const item = makeFeedItem({
      caption: 'Short caption here',
      author: 'creator1',
    });
    const posts = adapter.extractPosts(toNodeList([item]));

    expect(posts).toHaveLength(0);
  });

  it('feedSource returns for-you for home page', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.tiktok.com', pathname: '/' },
      writable: true,
      configurable: true,
    });
    const item = makeFeedItem({
      caption: 'A caption with enough characters to pass the thirty character minimum threshold',
      author: 'creator1',
    });
    const posts = adapter.extractPosts(toNodeList([item]));

    expect(posts[0].feedSource).toBe('for-you');
  });

  it('feedSource returns following for /following', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.tiktok.com', pathname: '/following' },
      writable: true,
      configurable: true,
    });
    const item = makeFeedItem({
      caption: 'A caption with enough characters to pass the thirty character minimum threshold',
      author: 'creator1',
    });
    const posts = adapter.extractPosts(toNodeList([item]));

    expect(posts[0].feedSource).toBe('following');
  });

  it('feedSource returns profile for /@username pages', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.tiktok.com', pathname: '/@dancequeen' },
      writable: true,
      configurable: true,
    });
    const item = makeFeedItem({
      caption: 'A caption with enough characters to pass the thirty character minimum threshold',
      author: 'dancequeen',
    });
    const posts = adapter.extractPosts(toNodeList([item]));

    expect(posts[0].feedSource).toBe('profile');
  });
});
