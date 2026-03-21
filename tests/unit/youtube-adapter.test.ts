// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { YoutubeAdapter } from '../../src/content/platforms/youtube';

// Helper: since jsdom doesn't support custom elements, we use div wrappers
// with matching structure and query by id/class.

function makeComment(opts: {
  text: string;
  author?: string;
  id?: string;
  processed?: boolean;
}): HTMLElement {
  const el = document.createElement('ytd-comment-renderer' as any) as HTMLElement;
  if (opts.id) el.setAttribute('id', opts.id);
  if (opts.processed) el.dataset.fwProcessed = 'true';

  el.innerHTML = `
    <div id="header">
      <a id="author-text" href="/@${opts.author ?? 'testuser'}">
        <span>${opts.author ?? 'testuser'}</span>
      </a>
    </div>
    <div id="content">
      <div id="content-text">
        <span class="yt-core-attributed-string">${opts.text}</span>
      </div>
    </div>
  `;
  return el;
}

function makeCommunityPost(opts: {
  text: string;
  author?: string;
  postId?: string;
}): HTMLElement {
  const el = document.createElement('ytd-backstage-post-renderer' as any) as HTMLElement;

  const linkHtml = opts.postId
    ? `<a href="/post/${opts.postId}">link</a>`
    : '';

  el.innerHTML = `
    <div id="content">
      <div id="content-text">
        <yt-attributed-string>${opts.text}</yt-attributed-string>
      </div>
    </div>
    <a id="author-text" href="/@${opts.author ?? 'channel'}">${opts.author ?? 'channel'}</a>
    ${linkHtml}
  `;
  return el;
}

function makeDescription(opts: {
  text: string;
  author?: string;
}): HTMLElement {
  const el = document.createElement('ytd-watch-metadata' as any) as HTMLElement;

  el.innerHTML = `
    <div id="description-inner">
      <ytd-text-inline-expander>
        <div id="description-inline-expander">
          <yt-attributed-string><span>${opts.text}</span></yt-attributed-string>
        </div>
      </ytd-text-inline-expander>
    </div>
    <a class="yt-simple-endpoint" href="/@${opts.author ?? 'creator'}">${opts.author ?? 'creator'}</a>
  `;
  return el;
}

function toNodeList(elements: HTMLElement[]): NodeList {
  const fragment = document.createDocumentFragment();
  for (const el of elements) {
    fragment.appendChild(el);
  }
  // We need to return the elements themselves as a NodeList-like;
  // use querySelectorAll on a wrapper
  const wrapper = document.createElement('div');
  for (const el of elements) {
    wrapper.appendChild(el);
  }
  return wrapper.childNodes;
}

function setLocation(path: string, search = '') {
  Object.defineProperty(window, 'location', {
    value: {
      hostname: 'www.youtube.com',
      pathname: path,
      search,
      href: `https://www.youtube.com${path}${search}`,
    },
    writable: true,
    configurable: true,
  });
}

describe('YoutubeAdapter', () => {
  let adapter: YoutubeAdapter;

  beforeEach(() => {
    adapter = new YoutubeAdapter();
    setLocation('/watch', '?v=dQw4w9WgXcb');
  });

  it('extracts comment text from ytd-comment-renderer', () => {
    const comment = makeComment({
      text: 'This is a comment that is long enough to be extracted by the adapter',
      id: 'comment-123',
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('This is a comment that is long enough');
    expect(posts[0].platform).toBe('youtube');
  });

  it('extracts comment author from #author-text span', () => {
    const comment = makeComment({
      text: 'A sufficiently long comment to pass the minimum length check',
      author: 'CoolUser42',
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(1);
    expect(posts[0].author).toBe('CoolUser42');
  });

  it('extracts community post text from ytd-backstage-post-renderer', () => {
    setLocation('/community');
    const post = makeCommunityPost({
      text: 'Hey everyone check out this cool community post with enough text',
      author: 'MyChannel',
      postId: 'Ugxyz123',
    });
    const posts = adapter.extractPosts(toNodeList([post]));

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toContain('community post');
    expect(posts[0].id).toBe('Ugxyz123');
  });

  it('skips already-processed elements', () => {
    const comment = makeComment({
      text: 'This comment is long enough but has already been processed before',
      id: 'comment-456',
      processed: true,
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(0);
  });

  it('skips text shorter than 20 chars', () => {
    const comment = makeComment({
      text: 'Too short',
      id: 'comment-short',
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(0);
  });

  it('extracts video ID from watch page URL for description', () => {
    setLocation('/watch', '?v=abc123XYZ');

    const desc = makeDescription({
      text: 'This is a video description that is long enough to be detected and processed',
      author: 'VideoCreator',
    });
    const posts = adapter.extractPosts(toNodeList([desc]));

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('abc123XYZ');
    expect(posts[0].author).toBe('VideoCreator');
  });

  it('feedSource returns for-you for home page', () => {
    setLocation('/');
    const comment = makeComment({
      text: 'A comment long enough to be processed by the adapter correctly',
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(1);
    expect(posts[0].feedSource).toBe('for-you');
  });

  it('feedSource returns search for /results', () => {
    setLocation('/results', '?search_query=test');
    const comment = makeComment({
      text: 'A comment long enough to be processed by the adapter correctly',
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(1);
    expect(posts[0].feedSource).toBe('search');
  });

  it('feedSource returns profile for channel pages', () => {
    setLocation('/@MrBeast');
    const comment = makeComment({
      text: 'A comment long enough to be processed by the adapter correctly',
    });
    const posts = adapter.extractPosts(toNodeList([comment]));

    expect(posts).toHaveLength(1);
    expect(posts[0].feedSource).toBe('profile');
  });

  it('processes description only once per container', () => {
    setLocation('/watch', '?v=onceOnly');

    const desc = makeDescription({
      text: 'Description text that should only be processed a single time by the adapter',
    });

    const posts1 = adapter.extractPosts(toNodeList([desc]));
    expect(posts1).toHaveLength(1);

    // Second call on the same element — should be skipped
    const wrapper = document.createElement('div');
    wrapper.appendChild(desc);
    const posts2 = adapter.extractPosts(wrapper.childNodes);
    expect(posts2).toHaveLength(0);
  });

  it('replaceContent stores original and sets new text', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>Original <b>content</b></span>';

    adapter.replaceContent(new WeakRef(el), 'Neutralized text');

    expect(el.textContent).toBe('Neutralized text');
    expect(el.dataset.fwOriginal).toContain('Original');
    expect(el.dataset.fwNeutralized).toBe('true');
  });
});
