/**
 * Returns engagement metric elements (like counts, view counts, share counts)
 * for a given platform. These get hidden in child/teen mode.
 *
 * Uses stable selectors per platform based on extraction stability analysis:
 * - YouTube: stable (Polymer IDs, custom elements)
 * - TikTok: moderate (data-e2e attributes + hydration JSON)
 * - Instagram: fragile (aria-labels only stable option)
 */
export function getMetricElements(platform: string): HTMLElement[] {
  const elements: HTMLElement[] = [];

  switch (platform) {
    case 'youtube': {
      // Like count text
      const likeCount = document.querySelector<HTMLElement>(
        'ytd-menu-renderer yt-formatted-string[aria-label*="like" i]'
      );
      if (likeCount) elements.push(likeCount);

      // View count
      const viewCount = document.querySelector<HTMLElement>(
        'ytd-video-primary-info-renderer ytd-video-view-count-renderer, ' +
        'ytd-watch-metadata span.view-count'
      );
      if (viewCount) elements.push(viewCount);

      // Comment count header
      const commentCount = document.querySelector<HTMLElement>(
        'ytd-comments-header-renderer h2 yt-formatted-string'
      );
      if (commentCount) elements.push(commentCount);

      // Subscribe count
      const subCount = document.querySelector<HTMLElement>(
        '#owner-sub-count'
      );
      if (subCount) elements.push(subCount);
      break;
    }

    case 'tiktok': {
      // Like, comment, bookmark, share counts (data-e2e selectors)
      const selectors = [
        '[data-e2e="like-count"]',
        '[data-e2e="comment-count"]',
        '[data-e2e="share-count"]',
        '[data-e2e="undefined-count"]',  // Bookmark count
      ];
      for (const sel of selectors) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el) elements.push(el);
      }
      break;
    }

    case 'instagram': {
      // Instagram: use aria-labels (only stable selectors)
      // Like count section
      const likeSection = document.querySelector<HTMLElement>(
        'section[class] span[class] a[role="link"]'
      );
      if (likeSection) elements.push(likeSection);

      // View count for reels
      const viewSection = document.querySelector<HTMLElement>(
        'span[class] span:has(> svg[aria-label*="Play"])'
      );
      if (viewSection) elements.push(viewSection);

      // Comment count (aria-label based, case-insensitive)
      const commentCount = document.querySelector<HTMLElement>(
        '[aria-label*="comment" i]'
      );
      if (commentCount) elements.push(commentCount);
      break;
    }
  }

  return elements;
}

/**
 * Returns the comments container element for video platforms.
 */
export function getCommentsContainer(platform: string): HTMLElement | null {
  switch (platform) {
    case 'youtube':
      return document.querySelector<HTMLElement>('ytd-comments#comments');
    case 'tiktok':
      return document.querySelector<HTMLElement>(
        '[data-e2e="comment-list"], ' +
        '[class*="CommentListContainer"]'
      );
    case 'instagram':
      // Instagram comments are within article > ul structures
      return document.querySelector<HTMLElement>(
        'article ul[class]'
      );
    default:
      return null;
  }
}
