// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { InstagramAdapter } from '../../src/content/platforms/instagram';

function makeArticle(innerHTML: string): HTMLElement {
  const article = document.createElement('article');
  article.innerHTML = innerHTML;
  return article;
}

function toNodeList(elements: HTMLElement[]): NodeList {
  const container = document.createElement('div');
  for (const el of elements) {
    container.appendChild(el);
  }
  return container.querySelectorAll('article');
}

describe('InstagramAdapter', () => {
  let adapter: InstagramAdapter;

  beforeEach(() => {
    adapter = new InstagramAdapter();
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.instagram.com', pathname: '/' },
      writable: true,
      configurable: true,
    });
  });

  it('extracts caption text from span[dir="auto"]', () => {
    const article = makeArticle(`
      <span dir="auto"><span>This is a long caption that should be extracted by the adapter properly.</span></span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('long caption that should be extracted');
  });

  it('skips spans inside ul (comments)', () => {
    const article = makeArticle(`
      <span dir="auto">Main caption text that is long enough to be extracted by the adapter.</span>
      <ul>
        <li>
          <span dir="auto">This is a comment that is even longer than the caption and should be skipped entirely.</span>
        </li>
      </ul>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('Main caption text');
    expect(posts[0].text).not.toContain('comment');
  });

  it('skips spans inside buttons', () => {
    const article = makeArticle(`
      <span dir="auto">A real caption that has enough text to pass the minimum length filter easily.</span>
      <button>
        <span dir="auto">Like this post button text that is long enough to potentially match.</span>
      </button>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('real caption');
    expect(posts[0].text).not.toContain('button text');
  });

  it('extracts author from a[role="link"] with /username/ href pattern', () => {
    const article = makeArticle(`
      <a href="/janedoe/" role="link"><span>janedoe</span></a>
      <span dir="auto">Caption text that is certainly long enough to pass the minimum length check.</span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].author).toBe('janedoe');
  });

  it('extracts post ID from /p/ URL pattern', () => {
    const article = makeArticle(`
      <a href="/p/CxYz123_Ab/">View</a>
      <span dir="auto">Caption text that is certainly long enough to pass the minimum length check.</span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('CxYz123_Ab');
  });

  it('extracts post ID from /reel/ URL pattern', () => {
    const article = makeArticle(`
      <a href="/reel/Abc789Def/">Watch</a>
      <span dir="auto">Caption text that is certainly long enough to pass the minimum length check.</span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('Abc789Def');
  });

  it('skips already-processed articles', () => {
    const article = makeArticle(`
      <span dir="auto">This post has enough text but should be skipped because it is already processed.</span>
    `);
    article.dataset.fwProcessed = 'true';
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(0);
  });

  it('skips text shorter than 20 characters', () => {
    const article = makeArticle(`
      <span dir="auto">Too short</span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(0);
  });

  it('picks longest qualifying span as caption', () => {
    const article = makeArticle(`
      <span dir="auto">This is a shorter caption that passes the minimum length.</span>
      <span dir="auto">This is the longest caption in the article and it should be the one selected by the adapter logic.</span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('longest caption in the article');
  });

  it('feedSource returns for-you for home page', () => {
    const article = makeArticle(`
      <span dir="auto">Caption text that is long enough to be extracted by the adapter properly.</span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].feedSource).toBe('for-you');
  });

  it('feedSource returns profile for /username/ pages', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.instagram.com', pathname: '/janedoe/' },
      writable: true,
      configurable: true,
    });

    const article = makeArticle(`
      <span dir="auto">Caption text that is long enough to be extracted by the adapter properly.</span>
    `);
    const posts = adapter.extractPosts(toNodeList([article]));

    expect(posts).toHaveLength(1);
    expect(posts[0].feedSource).toBe('profile');
  });
});
