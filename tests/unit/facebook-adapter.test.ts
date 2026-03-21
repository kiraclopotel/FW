// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FacebookAdapter } from '../../src/content/platforms/facebook';

function makeArticle(innerHTML: string): HTMLElement {
  const article = document.createElement('div');
  article.setAttribute('role', 'article');
  article.innerHTML = innerHTML;
  return article;
}

function toNodeList(elements: HTMLElement[]): NodeList {
  const container = document.createElement('div');
  for (const el of elements) {
    container.appendChild(el);
  }
  return container.querySelectorAll('div[role="article"]');
}

describe('FacebookAdapter', () => {
  let adapter: FacebookAdapter;

  beforeEach(() => {
    adapter = new FacebookAdapter();
    // Default location to facebook.com home
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.facebook.com', pathname: '/' },
      writable: true,
      configurable: true,
    });
  });

  it('extracts text from ad preview div', () => {
    const article = makeArticle(`
      <div data-ad-preview="message">This is a sponsored ad post with enough text to pass the minimum length filter.</div>
      <div dir="auto">Some other text that should not be picked because ad preview takes priority.</div>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('sponsored ad post');
  });

  it('extracts text from dir="auto" when no ad preview', () => {
    const article = makeArticle(`
      <a role="link" href="/johndoe"><strong>John Doe</strong></a>
      <div dir="auto">This is a regular Facebook post that has enough text to be extracted by the adapter.</div>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('regular Facebook post');
  });

  it('skips text elements inside UL (comments)', () => {
    const article = makeArticle(`
      <div dir="auto">Main post text that should be extracted because it is the actual post content here.</div>
      <ul>
        <div dir="auto">This is a comment text that is even longer than the main post content and should be skipped entirely by the adapter.</div>
      </ul>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('Main post text');
    expect(posts[0].text).not.toContain('comment text');
  });

  it('skips text inside nested articles (shared posts)', () => {
    const article = makeArticle(`
      <div dir="auto">Outer post text with enough characters to meet the minimum length requirement.</div>
      <div role="article">
        <div dir="auto">Shared post text inside a nested article that should be completely ignored by the adapter extraction logic.</div>
      </div>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    // Should extract the outer post only (the nested article is collected separately but its text is the nested one)
    const outerPost = posts.find(p => p.text.includes('Outer post text'));
    expect(outerPost).toBeDefined();
  });

  it('extracts author from strong tag inside link', () => {
    const article = makeArticle(`
      <a role="link" href="/janedoe"><strong>Jane Doe</strong></a>
      <div dir="auto">A post with enough text to be extracted as valid content by the adapter logic.</div>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].author).toBe('Jane Doe');
  });

  it('extracts post ID from /posts/ URL', () => {
    const article = makeArticle(`
      <a href="/someuser/posts/abc123def">View Post</a>
      <div dir="auto">Post content that is long enough to be extracted by the adapter properly.</div>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('abc123def');
  });

  it('extracts post ID from story_fbid parameter', () => {
    const article = makeArticle(`
      <a href="/permalink.php?story_fbid=9876543210&id=12345">View</a>
      <div dir="auto">Another post with content that satisfies the minimum length requirement for extraction.</div>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('9876543210');
  });

  it('skips already-processed articles', () => {
    const article = makeArticle(`
      <div dir="auto">This post has enough text but should be skipped because it is already processed.</div>
    `);
    article.dataset.fwProcessed = 'true';
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(0);
  });

  it('skips text shorter than 20 characters', () => {
    const article = makeArticle(`
      <div dir="auto">Too short</div>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(0);
  });

  it('returns feedSource based on URL path', () => {
    // Groups => following
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.facebook.com', pathname: '/groups/mygroup' },
      writable: true,
      configurable: true,
    });

    const article1 = makeArticle(`
      <div dir="auto">Group post text that is long enough to be extracted by the adapter properly.</div>
    `);
    let posts = adapter.extractPosts(toNodeList([article1]));
    expect(posts[0].feedSource).toBe('following');

    // Watch => for-you
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.facebook.com', pathname: '/watch' },
      writable: true,
      configurable: true,
    });

    const article2 = makeArticle(`
      <div dir="auto">Watch post text that is long enough to be extracted by the adapter properly.</div>
    `);
    posts = adapter.extractPosts(toNodeList([article2]));
    expect(posts[0].feedSource).toBe('for-you');

    // Home => unknown
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.facebook.com', pathname: '/' },
      writable: true,
      configurable: true,
    });

    const article3 = makeArticle(`
      <div dir="auto">Home feed post text that is long enough to be extracted by the adapter properly.</div>
    `);
    posts = adapter.extractPosts(toNodeList([article3]));
    expect(posts[0].feedSource).toBe('unknown');
  });
});
