// FeelingWise - Video Comment Injector
// Handles hide-first-populate-later comment replacement for video platforms.
// CRITICAL: Comments are hidden IMMEDIATELY on detection, before any API call.
// Children never see real comments, even for a millisecond.

import type { Mode } from '../types/mode';
import { createPlaceholder } from './comment-overlay';

// --- Hide comments immediately ---

/**
 * Hide comments and inject overlay using CSS injection.
 *
 * WHY CSS INJECTION: TikTok/Instagram are React apps. Setting
 * `element.style.display = 'none'` on React-managed elements gets
 * undone on the next render cycle. A <style> tag in <head> persists
 * because React doesn't manage <head>.
 *
 * We assign a unique CSS class to the container, then use a <style>
 * rule to hide all its REAL children (not our overlay).
 */
export function hideCommentsImmediately(
  commentsContainer: HTMLElement,
  mode: Mode,
): void {
  console.log('[FeelingWise] hideCommentsImmediately called, mode:', mode,
    'container:', commentsContainer.tagName, 'children:', commentsContainer.children.length);
  if (mode === 'adult') return;
  if (commentsContainer.dataset.fwHidden === 'true') return;
  commentsContainer.dataset.fwHidden = 'true';

  // Mark the container with a unique attribute for CSS targeting
  commentsContainer.setAttribute('data-fw-comment-container', 'true');

  // Inject a <style> rule that hides all children EXCEPT our overlay
  // This persists across React re-renders because it's in <head>
  injectCommentHidingCSS();

  // Insert a loading placeholder OUTSIDE the container (as a sibling)
  // so React can't remove it when it re-renders the container's children
  const placeholder = createPlaceholder(mode);
  commentsContainer.insertAdjacentElement('afterend', placeholder);

  // MutationObserver to maintain hiding if React removes the data attribute
  const observer = new MutationObserver(() => {
    if (!commentsContainer.hasAttribute('data-fw-comment-container')) {
      commentsContainer.setAttribute('data-fw-comment-container', 'true');
    }
  });
  observer.observe(commentsContainer, { attributes: true, childList: true });
}

// ─── TikTok child mode: direct CSS comment hiding ───
// Bypasses broken container detection entirely. Targets the actual comment
// elements using the same data-e2e selectors the TikTok adapter uses.

let tiktokCommentObserver: MutationObserver | null = null;

export function hideTikTokCommentsDirectCSS(): () => void {
  // Inject persistent CSS — survives React re-renders
  if (!document.querySelector('#fw-tiktok-child-hide-css')) {
    const style = document.createElement('style');
    style.id = 'fw-tiktok-child-hide-css';
    style.textContent = `
      [data-e2e="comment-level-1"],
      [data-e2e="comment-item"] {
        display: none !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
    console.log('[FeelingWise] TikTok child mode: comment CSS injected');
  }

  // Belt + suspenders: also set inline styles on existing comments
  document.querySelectorAll<HTMLElement>(
    '[data-e2e="comment-level-1"], [data-e2e="comment-item"]'
  ).forEach(el => {
    el.style.setProperty('display', 'none', 'important');
  });

  // MutationObserver for lazy-loaded comments
  if (!tiktokCommentObserver) {
    tiktokCommentObserver = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>(
        '[data-e2e="comment-level-1"], [data-e2e="comment-item"]'
      ).forEach(el => {
        if (el.style.display !== 'none') {
          el.style.setProperty('display', 'none', 'important');
        }
      });
    });
    tiktokCommentObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Return cleanup function
  return () => {
    const styleEl = document.querySelector('#fw-tiktok-child-hide-css');
    if (styleEl) styleEl.remove();
    if (tiktokCommentObserver) {
      tiktokCommentObserver.disconnect();
      tiktokCommentObserver = null;
    }
  };
}

// ─── Block action buttons (like, comment, share, bookmark icons) ───

const ACTION_ICON_SELECTORS: Record<string, string[]> = {
  tiktok: [
    '[data-e2e="like-icon"]',
    '[data-e2e="comment-icon"]',
    '[data-e2e="share-icon"]',
    '[data-e2e="undefined-icon"]',        // Bookmark (TikTok uses "undefined-icon")
  ],
  instagram: [
    'svg[aria-label*="Like" i]',
    'svg[aria-label*="place" i]',         // Romanian "Îmi place"
    'svg[aria-label*="Comment" i]',
    'svg[aria-label*="Coment" i]',        // Romanian "Comentează"
    'svg[aria-label*="Share" i]',
    'svg[aria-label*="Distribu" i]',      // Romanian "Distribuie"
    'svg[aria-label*="Save" i]',
    'svg[aria-label*="Salv" i]',          // Romanian "Salvează"
  ],
  facebook: [
    'span[role="toolbar"][aria-label*="reac" i]',
    'div[role="button"][aria-label*="Like" i]',
    'div[role="button"][aria-label*="place" i]',
    'div[role="button"][aria-label*="Comment" i]',
    'div[role="button"][aria-label*="Coment" i]',
    'div[role="button"][aria-label*="Share" i]',
    'div[role="button"][aria-label*="Distribu" i]',
  ],
  twitter: [
    'button[data-testid="reply"]',
    'button[data-testid="retweet"]',
    'button[data-testid="like"]',
    'button[data-testid="bookmark"]',
    'button[aria-label*="Share post" i]',
    'a[aria-label*="views" i]',
  ],
};

export function blockActionButtons(platform: string): void {
  const selectors = ACTION_ICON_SELECTORS[platform];
  if (!selectors) return;

  let found = false;
  for (const sel of selectors) {
    document.querySelectorAll<HTMLElement>(sel).forEach(el => {
      // Walk up to find the clickable parent: <button> OR [role="button"]
      const btn = el.closest('button') ?? el.closest('[role="button"]');
      const target = btn ?? el;
      if (target.dataset.fwActionBlocked === 'true') return;
      target.dataset.fwActionBlocked = 'true';
      target.style.setProperty('display', 'none', 'important');
      found = true;
    });
  }

  if (found) {
    injectActionButtonHidingCSS();
    console.log(`[FeelingWise] Action buttons blocked on ${platform}`);
  }
}

let actionCSSInjected = false;

function injectActionButtonHidingCSS(): void {
  if (actionCSSInjected) return;
  actionCSSInjected = true;

  const style = document.createElement('style');
  style.id = 'fw-action-hiding-css';
  style.textContent = `
    [data-fw-action-blocked="true"] {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

let commentCSSInjected = false;

function injectCommentHidingCSS(): void {
  if (commentCSSInjected) return;
  commentCSSInjected = true;

  const style = document.createElement('style');
  style.id = 'fw-comment-hiding-css';
  style.textContent = `
    /* Hide all real children of the comment container */
    [data-fw-comment-container="true"] > *:not(.fw-overlay):not(.fw-comment-overlay) {
      display: none !important;
    }
    /* Also hide nested list items (TikTok wraps comments in nested divs > ul > li) */
    [data-fw-comment-container="true"] li {
      display: none !important;
    }
    /* But keep the container itself visible (TikTok React detection) */
    [data-fw-comment-container="true"] {
      min-height: 100px;
    }
  `;
  document.head.appendChild(style);
}

// --- Block comment posting ---

const COMMENT_INPUT_SELECTORS: Record<string, string[]> = {
  youtube: [
    'ytd-comment-simplebox-renderer',
    '#placeholder-area',
    '#contenteditable-root',
  ],
  tiktok: [
    '[data-e2e="comment-input"]',
    '[contenteditable="true"]',
    '[placeholder*="comentariu" i]',
    '[placeholder*="comment" i]',
    '[data-e2e="comment-bottom"]',
    'div[class*="BottomInput"] [contenteditable]',
    'div[class*="bottom-input"] [contenteditable]',
  ],
  instagram: [
    'textarea[aria-label*="comment" i]',
    'textarea[placeholder*="comment" i]',
    'textarea[placeholder*="comentariu" i]',
  ],
};

export function blockCommentPosting(platform: string): void {
  const selectors = COMMENT_INPUT_SELECTORS[platform];
  if (!selectors) return;

  let found = false;
  for (const sel of selectors) {
    try {
      const els = document.querySelectorAll<HTMLElement>(sel);
      for (const el of els) {
        if (el.dataset.fwPostBlocked === 'true') continue;
        el.style.display = 'none';
        el.dataset.fwPostBlocked = 'true';
        found = true;
      }
    } catch { /* invalid selector — skip */ }
  }

  // Structural fallback 1: find any input-like element with comment-related text
  if (!found) {
    const editables = document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"], textarea, input[type="text"]'
    );
    for (const el of editables) {
      const text = (
        el.getAttribute('placeholder') ??
        el.getAttribute('aria-label') ??
        el.getAttribute('data-placeholder') ??
        el.textContent ?? ''
      ).toLowerCase();

      if (/comment|comentariu|reply|răspunde|adaugă/.test(text)) {
        if (el.dataset.fwPostBlocked === 'true') continue;
        el.style.display = 'none';
        el.dataset.fwPostBlocked = 'true';
        found = true;
      }
    }
  }

  // Structural fallback 2: find element containing comment-related text.
  // TikTok's input bar isn't a standard input — it's a div with visible text.
  // Walk elements looking for one with comment-prompt text, then hide its
  // nearest container that looks like an input bar (full-width, short height).
  if (!found) {
    const allElements = document.querySelectorAll<HTMLElement>('div, span, p');
    for (const el of allElements) {
      if (el.dataset.fwPostBlocked === 'true') continue;
      const directText = getDirectText(el).toLowerCase();
      if (!directText) continue;
      if (!/adaugă.*comentariu|add.*comment|comentează|write.*comment/i.test(directText)) continue;

      // Walk UP to find a container that spans the full width (the input bar)
      let target: HTMLElement = el;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const rect = parent.getBoundingClientRect();
        // Input bar is typically full-width or near-full-width
        if (rect.width > window.innerWidth * 0.6) {
          // Check if this parent is reasonably small (not the entire comment panel)
          if (rect.height < 80) {
            target = parent;
            break;
          }
        }
        parent = parent.parentElement;
      }

      target.style.display = 'none';
      target.dataset.fwPostBlocked = 'true';
      found = true;
      console.log(`[FeelingWise] Comment input blocked via text discovery: "${directText.slice(0, 40)}"`);
      break;
    }
  }

  // CSS injection fallback — hide via persistent CSS rule.
  // Even if React re-renders and removes inline styles, the CSS rule persists.
  if (found) {
    injectCommentInputHidingCSS();
    console.log(`[FeelingWise] Comment posting blocked on ${platform}`);
  }
}

function getDirectText(el: HTMLElement): string {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    }
  }
  return text.trim();
}

let inputCSSInjected = false;

function injectCommentInputHidingCSS(): void {
  if (inputCSSInjected) return;
  inputCSSInjected = true;

  const style = document.createElement('style');
  style.id = 'fw-input-hiding-css';
  style.textContent = `
    [data-fw-post-blocked="true"] {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}
