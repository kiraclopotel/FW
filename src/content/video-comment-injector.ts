// FeelingWise - Video Comment Injector
// Handles hide-first-populate-later comment replacement for video platforms.
// CRITICAL: Comments are hidden IMMEDIATELY on detection, before any API call.
// Children never see real comments, even for a millisecond.

import type { CommentRewriteResult, RewrittenComment } from '../analysis/comment-rewriter';
import type { Mode } from '../types/mode';

// --- Platform text size detection ---

function getPlatformFontSize(): number {
  const host = window.location.hostname;
  if (host.includes('tiktok.com')) return 14;
  if (host.includes('youtube.com')) return 13;
  if (host.includes('instagram.com')) return 14;
  return 13;
}

// --- Placeholder creation ---

function createPlaceholder(mode: 'child' | 'teen'): HTMLElement {
  const placeholder = document.createElement('div');
  placeholder.className = 'fw-comments-placeholder';
  placeholder.style.cssText = `
    padding: 20px 16px;
    margin: 8px 0;
    border-radius: 12px;
    background: rgba(30, 30, 30, 0.85);
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  // CSS-only spinner (no external assets)
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-top-color: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    animation: fw-spin 0.8s linear infinite;
  `;

  // Inject keyframes if not already present
  if (!document.querySelector('#fw-spinner-keyframes')) {
    const style = document.createElement('style');
    style.id = 'fw-spinner-keyframes';
    style.textContent = '@keyframes fw-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  const text = document.createElement('span');
  if (mode === 'child') {
    text.textContent = '\u{1F4A1} Se \u00eencarc\u0103...';
  } else {
    text.textContent = '\u2726 Se preg\u0103tesc comentariile...';
    placeholder.style.background = 'rgba(30, 30, 30, 0.6)';
  }

  placeholder.appendChild(spinner);
  placeholder.appendChild(text);
  return placeholder;
}

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
  placeholder.classList.add('fw-comment-overlay');
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
    '[data-e2e="favorite-icon"]',
  ],
};

export function blockActionButtons(platform: string): void {
  const selectors = ACTION_ICON_SELECTORS[platform];
  if (!selectors) return;

  let found = false;
  for (const sel of selectors) {
    document.querySelectorAll<HTMLElement>(sel).forEach(iconSpan => {
      const btn = iconSpan.closest('button');
      const target = btn ?? iconSpan;
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

// --- Remove placeholder helper ---

function removePlaceholder(commentsContainer: HTMLElement): void {
  // Placeholder is now a SIBLING (inserted via insertAdjacentElement('afterend'))
  const placeholder = commentsContainer.parentElement?.querySelector(
    '.fw-comment-overlay.fw-comments-placeholder, .fw-comments-placeholder'
  );
  if (placeholder) placeholder.remove();
  // Also check for old-style child placeholder (backward compat)
  const childPlaceholder = commentsContainer.querySelector('.fw-comments-placeholder');
  if (childPlaceholder) childPlaceholder.remove();
}

// --- Restore container visibility ---

function restoreVisibility(commentsContainer: HTMLElement): void {
  commentsContainer.style.visibility = 'visible';
  commentsContainer.style.maxHeight = '';
  commentsContainer.style.overflow = '';
}

// --- Child mode: educational overlay ---

export function injectChildEducationalOverlay(
  commentsContainer: HTMLElement,
  result: CommentRewriteResult,
): void {
  // Remove the loading placeholder (it's a sibling now, not a child)
  removePlaceholder(commentsContainer);

  // Remove any previous overlay
  const prev = commentsContainer.parentElement?.querySelector('.fw-comment-overlay');
  if (prev) prev.remove();

  const fontSize = getPlatformFontSize();

  const overlay = document.createElement('div');
  overlay.className = 'fw-comment-overlay';
  overlay.style.cssText = `
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    font-size: ${fontSize + 1}px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    padding-bottom: 8px;
  `;
  header.textContent = '\u{1F4A1} \u0218tiai c\u0103?';
  overlay.appendChild(header);

  // Educational cards
  for (const comment of result.comments) {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 12px 14px;
    `;

    // Topic pill
    if (comment.educationalTopic) {
      const pill = document.createElement('span');
      pill.style.cssText = `
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        background: rgba(0, 188, 175, 0.2);
        color: #4dd9cc;
        margin-bottom: 8px;
      `;
      pill.textContent = comment.educationalTopic;
      card.appendChild(pill);
    }

    // Fact/question text
    const text = document.createElement('div');
    text.style.cssText = `
      font-size: ${fontSize}px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.85);
    `;
    text.textContent = comment.rewritten;
    card.appendChild(text);

    overlay.appendChild(card);
  }

  // KEY CHANGE: Insert as sibling AFTER container, not as child
  commentsContainer.insertAdjacentElement('afterend', overlay);
}

// --- Teen mode: rewritten comments with toggles ---

export function injectTeenRewrittenComments(
  commentsContainer: HTMLElement,
  result: CommentRewriteResult,
  showLessons: boolean,
): void {
  // Remove the loading placeholder (it's a sibling now)
  removePlaceholder(commentsContainer);

  // Remove any previous overlay
  const prev = commentsContainer.parentElement?.querySelector('.fw-comment-overlay');
  if (prev) prev.remove();

  const fontSize = getPlatformFontSize();

  const overlay = document.createElement('div');
  overlay.className = 'fw-comment-overlay';
  overlay.style.cssText = `
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  // Track all card toggle elements for global toggle
  const cardPairs: { rewrittenDiv: HTMLElement; originalDiv: HTMLElement; toggleBtn: HTMLElement }[] = [];
  let globalShowingOriginals = false;

  // Global toggle header
  const headerRow = document.createElement('div');
  headerRow.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
  `;

  const headerText = document.createElement('span');
  headerText.style.cssText = `
    font-size: ${fontSize + 1}px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  `;
  headerText.textContent = '\u2726 Comentarii rescrise';

  const globalToggle = document.createElement('button');
  globalToggle.style.cssText = `
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  `;
  globalToggle.textContent = 'Arat\u0103 toate originalele';

  globalToggle.addEventListener('click', () => {
    globalShowingOriginals = !globalShowingOriginals;
    globalToggle.textContent = globalShowingOriginals
      ? 'Arat\u0103 toate rescrise'
      : 'Arat\u0103 toate originalele';

    for (const pair of cardPairs) {
      pair.rewrittenDiv.style.display = globalShowingOriginals ? 'none' : 'block';
      pair.originalDiv.style.display = globalShowingOriginals ? 'block' : 'none';
      pair.toggleBtn.textContent = globalShowingOriginals
        ? 'Arat\u0103 rescris'
        : 'Arat\u0103 original';
    }
  });

  headerRow.appendChild(headerText);
  headerRow.appendChild(globalToggle);
  overlay.appendChild(headerRow);

  // Comment cards
  for (const comment of result.comments) {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(255, 255, 255, 0.04);
      border-radius: 10px;
      padding: 12px 14px;
      border-left: 3px solid rgba(255, 171, 64, 0.7);
    `;

    // Rewritten text (visible by default)
    const rewrittenDiv = document.createElement('div');
    rewrittenDiv.style.cssText = `
      font-size: ${fontSize}px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.85);
    `;
    rewrittenDiv.textContent = comment.rewritten;

    // Original text (hidden by default)
    const originalDiv = document.createElement('div');
    originalDiv.style.cssText = `
      font-size: ${fontSize}px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.5);
      display: none;
    `;
    originalDiv.textContent = comment.original;

    card.appendChild(rewrittenDiv);
    card.appendChild(originalDiv);

    // Per-card toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.style.cssText = `
      background: none;
      border: none;
      padding: 4px 0;
      margin-top: 6px;
      font-size: 11px;
      color: rgba(255, 171, 64, 0.8);
      cursor: pointer;
    `;
    toggleBtn.textContent = 'Arat\u0103 original';

    toggleBtn.addEventListener('click', () => {
      const showingOriginal = originalDiv.style.display !== 'none';
      rewrittenDiv.style.display = showingOriginal ? 'block' : 'none';
      originalDiv.style.display = showingOriginal ? 'none' : 'block';
      toggleBtn.textContent = showingOriginal ? 'Arat\u0103 original' : 'Arat\u0103 rescris';
    });

    card.appendChild(toggleBtn);

    cardPairs.push({ rewrittenDiv, originalDiv, toggleBtn });

    // Sarcasm decoded tag
    if (comment.sarcasmDecoded) {
      const sarcasmTag = document.createElement('span');
      sarcasmTag.style.cssText = `
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
        background: rgba(255, 171, 64, 0.15);
        color: #ffab40;
        margin-top: 6px;
      `;
      sarcasmTag.textContent = 'Sarcasm decodat';
      card.appendChild(sarcasmTag);
    }

    // Technique pill + lesson
    if (showLessons && comment.technique) {
      const lessonRow = document.createElement('div');
      lessonRow.style.cssText = `
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        flex-direction: column;
        gap: 4px;
      `;

      const techniquePill = document.createElement('span');
      techniquePill.style.cssText = `
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
        background: rgba(128, 128, 128, 0.15);
        color: rgba(255, 255, 255, 0.6);
        align-self: flex-start;
      `;
      techniquePill.textContent = comment.technique;
      lessonRow.appendChild(techniquePill);

      if (comment.lesson) {
        const lessonText = document.createElement('div');
        lessonText.style.cssText = `
          font-size: 11px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.5);
        `;
        lessonText.textContent = comment.lesson;
        lessonRow.appendChild(lessonText);
      }

      card.appendChild(lessonRow);
    }

    overlay.appendChild(card);
  }

  // KEY CHANGE: Insert as sibling AFTER container, not as child
  commentsContainer.insertAdjacentElement('afterend', overlay);
}

// --- Hide engagement metrics ---

export function hideEngagementMetrics(elements: HTMLElement[]): void {
  for (const el of elements) {
    if (el.dataset.fwMetricHidden === 'true') continue;
    el.style.visibility = 'hidden';
    el.style.width = '0';
    el.style.overflow = 'hidden';
    el.setAttribute('aria-hidden', 'true');
    el.dataset.fwMetricHidden = 'true';
  }
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
