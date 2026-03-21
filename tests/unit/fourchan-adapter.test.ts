// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FourchanAdapter } from '../../src/content/platforms/fourchan';

function buildThread(): HTMLElement {
  const board = document.createElement('div');
  board.className = 'board';

  // OP post
  board.innerHTML = `
    <div class="postContainer opContainer" id="pc12345678">
      <div class="post op">
        <span class="nameBlock"><span class="name">Anonymous</span></span>
        <blockquote class="postMessage" id="m12345678">
          This is the original post with enough text to pass the minimum length requirement.
          <br>
          More text on new lines here.
          <a href="#p12345679" class="quotelink">&gt;&gt;12345679</a>
        </blockquote>
      </div>
    </div>
    <div class="postContainer replyContainer" id="pc12345679">
      <div class="post reply">
        <span class="nameBlock">
          <span class="name">Anonymous</span>
          <span class="postertrip">!TripCode123</span>
        </span>
        <blockquote class="postMessage" id="m12345679">
          This is a reply with a tripcode author and enough text to be extracted properly.
        </blockquote>
      </div>
    </div>
    <div class="postContainer replyContainer" id="pc12345680">
      <div class="post reply">
        <span class="nameBlock"><span class="name">Anonymous</span></span>
        <blockquote class="postMessage" id="m12345680">short</blockquote>
      </div>
    </div>
    <div class="postContainer replyContainer" id="pc12345681" data-fw-processed="true">
      <div class="post reply">
        <span class="nameBlock"><span class="name">Anonymous</span></span>
        <blockquote class="postMessage" id="m12345681">
          This post was already processed and should be skipped entirely by the adapter.
        </blockquote>
      </div>
    </div>
  `;

  return board;
}

describe('FourchanAdapter', () => {
  let adapter: FourchanAdapter;

  beforeEach(() => {
    adapter = new FourchanAdapter();
  });

  it('extracts post text from .postMessage', () => {
    const board = buildThread();
    const nodes = board.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts[0].text).toContain('original post');
  });

  it('extracts author from .name (Anonymous)', () => {
    const board = buildThread();
    const nodes = board.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    // OP has no tripcode, so author should be from .name
    expect(posts[0].author).toBe('Anonymous');
  });

  it('extracts author from .postertrip when present', () => {
    const board = buildThread();
    const nodes = board.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    // Second post has a tripcode
    const tripPost = posts.find(p => p.id === '12345679');
    expect(tripPost).toBeDefined();
    expect(tripPost!.author).toBe('!TripCode123');
  });

  it('extracts post ID from container id attribute (strips pc prefix)', () => {
    const board = buildThread();
    const nodes = board.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    expect(posts[0].id).toBe('12345678');
  });

  it('skips posts marked as data-fw-processed', () => {
    const board = buildThread();
    const nodes = board.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    const processedPost = posts.find(p => p.id === '12345681');
    expect(processedPost).toBeUndefined();
  });

  it('skips posts with text shorter than 20 chars', () => {
    const board = buildThread();
    const nodes = board.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    // pc12345680 has "short" which is < 20 chars
    const shortPost = posts.find(p => p.id === '12345680');
    expect(shortPost).toBeUndefined();
  });

  it('cleans quotelinks from text', () => {
    const board = buildThread();
    const nodes = board.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    // OP text should not contain >>12345679
    expect(posts[0].text).not.toContain('>>12345679');
    expect(posts[0].text).not.toContain('quotelink');
  });

  it('handles empty nodeList gracefully', () => {
    const empty = document.createDocumentFragment();
    const nodes = empty.querySelectorAll('.postContainer');
    const posts = adapter.extractPosts(nodes as unknown as NodeList);

    expect(posts).toEqual([]);
  });
});
