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
  const container = document.querySelector<HTMLElement>('[data-e2e="comment-list"]');
  if (!container) return [];

  const children = Array.from(container.children) as HTMLElement[];
  const comments: RawComment[] = [];

  for (const child of children) {
    // Skip non-comment elements (loading spinners, etc.)
    if (child.childElementCount === 0) continue;

    // Text: find the longest text node within the comment block
    const textNodes = child.querySelectorAll('span, p, div');
    let text = '';
    for (const node of textNodes) {
      const content = node.textContent?.trim() ?? '';
      if (content.length > text.length) {
        text = content;
      }
    }
    if (!text) continue;

    // Author: element with link to user profile
    const authorLink = child.querySelector('a[href*="/@"]');
    const authorHandle = authorLink?.textContent?.trim() ?? '';

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
      default:
        return [];
    }
  } catch (e) {
    console.warn(`[FeelingWise] Comment extraction failed for ${platform}:`, e);
    return [];
  }
}
