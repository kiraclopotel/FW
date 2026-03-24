// FeelingWise - Comment Extractors
// Reads comments FROM the DOM into RawComment objects for scoring/rewriting.
// Platform selectors are fragile — all extractors degrade gracefully (empty array, never throw).

import type { RawComment } from '../../analysis/comment-scorer';

// --- Helpers ---

function parseLikeCount(text: string | null | undefined): number {
  if (!text) return 0;
  const cleaned = text.trim().replace(/,/g, '');
  if (!cleaned) return 0;

  const match = cleaned.match(/^([\d.]+)\s*([KkMm])?$/);
  if (!match) return 0;

  let num = parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();
  if (suffix === 'K') num *= 1000;
  if (suffix === 'M') num *= 1000000;
  return Math.round(num);
}

// --- YouTube ---

function extractYouTubeComments(): RawComment[] {
  const container = document.querySelector('ytd-comments#comments');
  if (!container) return [];

  const threads = container.querySelectorAll('ytd-comment-thread-renderer');
  const comments: RawComment[] = [];

  for (const thread of threads) {
    const textEl = thread.querySelector('#content-text');
    const text = textEl?.textContent?.trim() ?? '';
    if (!text) continue;

    const authorEl = thread.querySelector('#author-text');
    const authorHandle = authorEl?.textContent?.trim() ?? '';

    const likeEl = thread.querySelector('#vote-count-middle');
    const likes = parseLikeCount(likeEl?.textContent);

    const timeEl = thread.querySelector(
      '#published-time-text a, yt-formatted-string.published-time-text'
    );
    const timestamp = timeEl?.textContent?.trim() ?? '';

    const isPinned = thread.querySelector('ytd-pinned-comment-badge-renderer') !== null;
    const isCreatorReply = thread.querySelector('#creator-heart') !== null;

    comments.push({
      text,
      likes,
      replies: 0,
      isPinned,
      isCreatorReply,
      isHighlighted: false,
      authorHandle,
      timestamp,
    });
  }

  return comments;
}

// --- TikTok ---

function extractTikTokComments(): RawComment[] {
  // Try known selector first
  let container = document.querySelector<HTMLElement>('[data-e2e="comment-list"]');

  // Structural fallback: find UL with comment-like children
  if (!container) {
    const allULs = document.querySelectorAll<HTMLElement>('ul');
    for (const ul of allULs) {
      if (ul.children.length < 2) continue;
      let commentLike = 0;
      for (const child of Array.from(ul.children).slice(0, 5)) {
        if (child instanceof HTMLElement && child.querySelector('a[href*="/@"]')) {
          commentLike++;
        }
      }
      if (commentLike >= 2) {
        container = ul;
        break;
      }
    }
  }

  if (!container) return [];

  const children = Array.from(container.children) as HTMLElement[];
  const comments: RawComment[] = [];

  // Known UI labels to skip (multi-language)
  const UI_LABEL = /^(Reply|Răspunde|Replies|Pinned|Fixat|Like|Share|Report|Vezi .* de r[aă]spunsuri|See \d+ repl|View \d+ repl|\u2026)$/i;

  for (const child of children) {
    // Skip non-comment elements (loading spinners, etc.)
    if (child.childElementCount === 0) continue;

    // Extract author FIRST so we can exclude it from comment text search
    const authorLink = child.querySelector('a[href*="/@"]');
    const authorHandle = authorLink?.textContent?.trim() ?? '';

    // Text: find the longest NON-author, NON-UI text node
    const textNodes = child.querySelectorAll('span, p, div');
    let text = '';
    for (const node of textNodes) {
      const content = node.textContent?.trim() ?? '';
      if (!content || content.length < 2) continue;
      // Skip if matches author handle
      if (authorHandle && content === authorHandle) continue;
      // Skip numeric-only (like counts, timestamps)
      if (/^[\d,.KkMm\s]+$/.test(content)) continue;
      // Skip known UI labels
      if (UI_LABEL.test(content)) continue;
      // Pick longest remaining
      if (content.length > text.length) {
        text = content;
      }
    }
    if (!text) continue;

    // Like count: look for a number near a heart/like element
    let likes = 0;
    const countEls = child.querySelectorAll('span');
    for (const el of countEls) {
      const t = el.textContent?.trim() ?? '';
      if (/^\d+(\.\d+)?[KkMm]?$/.test(t) && t !== text.slice(0, t.length)) {
        likes = parseLikeCount(t);
        break;
      }
    }

    // Pinned: check for "Pinned" text
    const isPinned = child.textContent?.includes('Pinned') ?? false;

    comments.push({
      text,
      likes,
      replies: 0,
      isPinned,
      isCreatorReply: false,
      isHighlighted: false,
      authorHandle,
      timestamp: '',
    });
  }

  return comments;
}

// --- Instagram ---

function extractInstagramComments(): RawComment[] {
  const article = document.querySelector('article');
  if (!article) return [];

  const commentList = article.querySelector('ul');
  if (!commentList) return [];

  const items = commentList.querySelectorAll('li');
  const comments: RawComment[] = [];

  for (const item of items) {
    const authorLink = item.querySelector('a[href^="/"]');
    const authorHandle = authorLink?.textContent?.trim() ?? '';
    if (!authorHandle) continue;

    // Text: innerText of the comment span, excluding username
    const spans = item.querySelectorAll('span');
    let text = '';
    for (const span of spans) {
      const content = span.textContent?.trim() ?? '';
      if (content.length > text.length && content !== authorHandle) {
        text = content;
      }
    }
    if (!text) continue;

    comments.push({
      text,
      likes: 0, // Rarely visible in DOM on web
      replies: 0,
      isPinned: false,
      isCreatorReply: false,
      isHighlighted: false,
      authorHandle,
      timestamp: '',
    });
  }

  return comments;
}

// --- Facebook ---

function extractFacebookComments(): RawComment[] {
  // Facebook comments live inside UL elements within article containers
  const articles = document.querySelectorAll<HTMLElement>('div[role="article"]');
  const comments: RawComment[] = [];

  for (const article of articles) {
    const lists = article.querySelectorAll<HTMLElement>('ul');
    for (const ul of lists) {
      const items = ul.querySelectorAll<HTMLElement>(':scope > li');
      if (items.length < 1) continue;

      for (const item of items) {
        // Author: link with profile-like href
        const authorLink = item.querySelector<HTMLAnchorElement>('a[role="link"]');
        const authorHandle = authorLink?.textContent?.trim() ?? '';
        if (!authorHandle) continue;

        // Text: longest div[dir="auto"] that isn't the author name
        const textNodes = item.querySelectorAll<HTMLElement>('div[dir="auto"]');
        let text = '';
        for (const node of textNodes) {
          const content = node.textContent?.trim() ?? '';
          if (content.length > text.length && content !== authorHandle) {
            text = content;
          }
        }
        if (!text || text.length < 3) continue;

        // Like count: look for aria-label with "like" and a number
        let likes = 0;
        const likeEl = item.querySelector<HTMLElement>('[aria-label*="like" i]');
        if (likeEl) {
          const match = likeEl.getAttribute('aria-label')?.match(/(\d+)/);
          if (match) likes = parseInt(match[1], 10);
        }

        comments.push({
          text,
          likes,
          replies: 0,
          isPinned: false,
          isCreatorReply: false,
          isHighlighted: false,
          authorHandle,
          timestamp: '',
        });
      }
    }
  }

  return comments;
}

// --- Main entry point ---

export function extractComments(platform: string): RawComment[] {
  try {
    switch (platform) {
      case 'youtube':
        return extractYouTubeComments();
      case 'tiktok':
        return extractTikTokComments();
      case 'instagram':
        return extractInstagramComments();
      case 'facebook':
        return extractFacebookComments();
      default:
        return [];
    }
  } catch (e) {
    console.warn(`[FeelingWise] Comment extraction failed for ${platform}:`, e);
    return [];
  }
}
