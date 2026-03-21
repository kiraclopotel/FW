// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { RedditAdapter } from '../../src/content/platforms/reddit';

/* ── Old Reddit helpers ── */

function makeOldRedditPost(opts: {
  author?: string;
  fullname?: string;
  title?: string;
  selfText?: string;
}): HTMLElement {
  const thing = document.createElement('div');
  thing.classList.add('thing', 'link');
  if (opts.fullname) thing.setAttribute('data-fullname', opts.fullname);
  if (opts.author) thing.setAttribute('data-author', opts.author);

  if (opts.title) {
    const a = document.createElement('a');
    a.classList.add('title');
    a.textContent = opts.title;
    thing.appendChild(a);
  }

  if (opts.selfText) {
    const expando = document.createElement('div');
    expando.classList.add('expando');
    expando.innerHTML = `<div class="usertext-body"><div class="md"><p>${opts.selfText}</p></div></div>`;
    thing.appendChild(expando);
  }

  return thing;
}

function makeOldRedditComment(opts: {
  author?: string;
  fullname?: string;
  text?: string;
}): HTMLElement {
  const thing = document.createElement('div');
  thing.classList.add('comment');
  if (opts.fullname) thing.setAttribute('data-fullname', opts.fullname);
  if (opts.author) thing.setAttribute('data-author', opts.author);

  if (opts.text) {
    const body = document.createElement('div');
    body.classList.add('usertext-body');
    body.innerHTML = `<div class="md"><p>${opts.text}</p></div>`;
    thing.appendChild(body);
  }

  return thing;
}

/* ── New Reddit helpers ── */

function makeNewRedditPost(opts: {
  id?: string;
  author?: string;
  title?: string;
  selfText?: string;
}): HTMLElement {
  // jsdom doesn't support custom elements, so use div with matching tag behavior
  const el = document.createElement('div');
  // We can't make tagName 'shreddit-post' in jsdom, so we use attributes
  // and query by attribute instead. The adapter uses tagName checks, so we
  // need to use a workaround: create the element via createElementNS or just
  // test via the old reddit path. Instead, let's test attribute-based extraction.
  //
  // Actually, jsdom DOES allow document.createElement('shreddit-post') - it creates
  // an HTMLUnknownElement with the correct tagName.
  const post = document.createElement('shreddit-post');
  if (opts.id) post.setAttribute('id', opts.id);
  if (opts.author) post.setAttribute('author', opts.author);

  if (opts.title) {
    const a = document.createElement('a');
    a.setAttribute('slot', 'title');
    a.textContent = opts.title;
    post.appendChild(a);
  }

  if (opts.selfText) {
    const div = document.createElement('div');
    div.setAttribute('slot', 'text-body');
    div.classList.add('md');
    div.innerHTML = `<p>${opts.selfText}</p>`;
    post.appendChild(div);
  }

  return post;
}

function makeNewRedditComment(opts: {
  thingid?: string;
  author?: string;
  text?: string;
}): HTMLElement {
  const comment = document.createElement('shreddit-comment');
  if (opts.thingid) comment.setAttribute('thingid', opts.thingid);
  if (opts.author) comment.setAttribute('author', opts.author);

  if (opts.text) {
    const div = document.createElement('div');
    div.setAttribute('slot', 'comment');
    div.innerHTML = `<p>${opts.text}</p>`;
    comment.appendChild(div);
  }

  return comment;
}

function toNodeList(elements: HTMLElement[]): NodeList {
  const container = document.createElement('div');
  for (const el of elements) {
    container.appendChild(el);
  }
  return container.childNodes;
}

/* ── Tests ── */

describe('RedditAdapter', () => {
  let adapter: RedditAdapter;

  beforeEach(() => {
    adapter = new RedditAdapter();
    Object.defineProperty(window, 'location', {
      value: { hostname: 'old.reddit.com', pathname: '/' },
      writable: true,
      configurable: true,
    });
    // Clear any .thing.link elements that might leak between tests
    document.body.innerHTML = '';
  });

  describe('Old Reddit', () => {
    it('extracts post title from a.title', () => {
      const thing = makeOldRedditPost({
        author: 'testuser',
        fullname: 't3_abc123',
        title: 'This is a long enough post title for extraction',
      });
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts).toHaveLength(1);
      expect(posts[0].text).toBe('This is a long enough post title for extraction');
    });

    it('extracts self-text from .usertext-body .md', () => {
      const thing = makeOldRedditPost({
        author: 'testuser',
        fullname: 't3_abc123',
        title: 'Short',
        selfText: 'This is the self-text body of a Reddit post that is long enough to be extracted',
      });
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts).toHaveLength(1);
      expect(posts[0].text).toContain('self-text body');
    });

    it('extracts author from data-author attribute', () => {
      const thing = makeOldRedditPost({
        author: 'spez',
        fullname: 't3_abc123',
        selfText: 'A post with enough text to pass the minimum length requirement for extraction',
      });
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBe('spez');
    });

    it('extracts post ID from data-fullname', () => {
      const thing = makeOldRedditPost({
        author: 'testuser',
        fullname: 't3_def456',
        selfText: 'A post with enough text to pass the minimum length requirement for extraction',
      });
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe('t3_def456');
    });

    it('extracts comment text', () => {
      const comment = makeOldRedditComment({
        author: 'commentuser',
        fullname: 't1_xyz789',
        text: 'This is a comment that is long enough to be extracted by the adapter',
      });
      const posts = adapter.extractPosts(toNodeList([comment]));

      expect(posts).toHaveLength(1);
      expect(posts[0].text).toContain('comment that is long enough');
      expect(posts[0].id).toBe('t1_xyz789');
      expect(posts[0].author).toBe('commentuser');
    });
  });

  describe('New Reddit', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'www.reddit.com', pathname: '/' },
        writable: true,
        configurable: true,
      });
    });

    it('extracts text from [slot="text-body"]', () => {
      const post = makeNewRedditPost({
        id: 't3_new123',
        author: 'newuser',
        selfText: 'This is a new Reddit post body that is long enough for extraction',
      });
      const posts = adapter.extractPosts(toNodeList([post]));

      expect(posts).toHaveLength(1);
      expect(posts[0].text).toContain('new Reddit post body');
    });

    it('extracts author from author attribute', () => {
      const post = makeNewRedditPost({
        id: 't3_new123',
        author: 'cooluser42',
        selfText: 'This is a new Reddit post body that is long enough for extraction',
      });
      const posts = adapter.extractPosts(toNodeList([post]));

      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBe('cooluser42');
    });

    it('extracts post ID from id attribute', () => {
      const post = makeNewRedditPost({
        id: 't3_qwerty',
        author: 'testuser',
        selfText: 'This is a new Reddit post body that is long enough for extraction',
      });
      const posts = adapter.extractPosts(toNodeList([post]));

      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe('t3_qwerty');
    });

    it('extracts comment text from shreddit-comment', () => {
      const comment = makeNewRedditComment({
        thingid: 't1_comm456',
        author: 'commenter',
        text: 'A comment on new Reddit that is definitely long enough to be extracted',
      });
      const posts = adapter.extractPosts(toNodeList([comment]));

      expect(posts).toHaveLength(1);
      expect(posts[0].text).toContain('comment on new Reddit');
      expect(posts[0].id).toBe('t1_comm456');
    });
  });

  describe('shared behavior', () => {
    it('skips already-processed elements', () => {
      const thing = makeOldRedditPost({
        author: 'testuser',
        fullname: 't3_abc123',
        selfText: 'This post has enough text but should be skipped because it is already processed',
      });
      thing.dataset.fwProcessed = 'true';
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts).toHaveLength(0);
    });

    it('skips text shorter than 20 chars', () => {
      const thing = makeOldRedditPost({
        author: 'testuser',
        fullname: 't3_abc123',
        title: 'Too short',
      });
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts).toHaveLength(0);
    });
  });

  describe('feed source detection', () => {
    it('returns for-you for home page', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'old.reddit.com', pathname: '/' },
        writable: true,
        configurable: true,
      });
      const thing = makeOldRedditPost({
        author: 'testuser',
        fullname: 't3_abc123',
        selfText: 'A post with enough text to pass the minimum length requirement for testing feed source',
      });
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts[0].feedSource).toBe('for-you');
    });

    it('returns following for subreddit page', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'old.reddit.com', pathname: '/r/javascript' },
        writable: true,
        configurable: true,
      });
      const thing = makeOldRedditPost({
        author: 'testuser',
        fullname: 't3_abc123',
        selfText: 'A post with enough text to pass the minimum length requirement for testing feed source',
      });
      const posts = adapter.extractPosts(toNodeList([thing]));

      expect(posts[0].feedSource).toBe('following');
    });

    it('returns profile for comments page', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'www.reddit.com', pathname: '/r/javascript/comments/abc123/some_title' },
        writable: true,
        configurable: true,
      });
      const post = makeNewRedditPost({
        id: 't3_abc123',
        author: 'testuser',
        selfText: 'A post with enough text to pass the minimum length requirement for testing feed source',
      });
      const posts = adapter.extractPosts(toNodeList([post]));

      expect(posts[0].feedSource).toBe('profile');
    });

    it('returns search for search page', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'www.reddit.com', pathname: '/search' },
        writable: true,
        configurable: true,
      });
      const post = makeNewRedditPost({
        id: 't3_abc123',
        author: 'testuser',
        selfText: 'A post with enough text to pass the minimum length requirement for testing feed source',
      });
      const posts = adapter.extractPosts(toNodeList([post]));

      expect(posts[0].feedSource).toBe('search');
    });
  });
});
