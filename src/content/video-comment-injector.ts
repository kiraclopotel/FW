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

export function hideCommentsImmediately(
  commentsContainer: HTMLElement,
  mode: Mode,
): void {
  if (mode === 'adult') return;
  if (commentsContainer.dataset.fwHidden === 'true') return;

  commentsContainer.style.visibility = 'hidden';
  commentsContainer.style.maxHeight = '0';
  commentsContainer.style.overflow = 'hidden';
  commentsContainer.dataset.fwHidden = 'true';

  const placeholder = createPlaceholder(mode);
  commentsContainer.insertAdjacentElement('beforebegin', placeholder);
}

// --- Remove placeholder helper ---

function removePlaceholder(commentsContainer: HTMLElement): void {
  const placeholder = commentsContainer.previousElementSibling;
  if (placeholder?.classList.contains('fw-comments-placeholder')) {
    placeholder.remove();
  }
}

// --- Restore container visibility ---

function restoreVisibility(commentsContainer: HTMLElement): void {
  commentsContainer.style.visibility = 'visible';
  commentsContainer.style.maxHeight = '';
  commentsContainer.style.overflow = '';
}

// --- Hide real comment children ---

function hideRealChildren(container: HTMLElement): void {
  for (const child of Array.from(container.children)) {
    if (!(child as HTMLElement).classList?.contains('fw-overlay')) {
      (child as HTMLElement).style.display = 'none';
    }
  }
}

// --- Child mode: educational overlay ---

export function injectChildEducationalOverlay(
  commentsContainer: HTMLElement,
  result: CommentRewriteResult,
): void {
  removePlaceholder(commentsContainer);
  hideRealChildren(commentsContainer);

  const fontSize = getPlatformFontSize();

  const overlay = document.createElement('div');
  overlay.className = 'fw-overlay';
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

  commentsContainer.appendChild(overlay);
  restoreVisibility(commentsContainer);
}

// --- Teen mode: rewritten comments with toggles ---

export function injectTeenRewrittenComments(
  commentsContainer: HTMLElement,
  result: CommentRewriteResult,
  showLessons: boolean,
): void {
  removePlaceholder(commentsContainer);
  hideRealChildren(commentsContainer);

  const fontSize = getPlatformFontSize();

  const overlay = document.createElement('div');
  overlay.className = 'fw-overlay';
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

  commentsContainer.appendChild(overlay);
  restoreVisibility(commentsContainer);
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
    'div[contenteditable="true"]',
  ],
  instagram: [
    'textarea[aria-label*="comment" i]',
    'textarea[placeholder*="comment" i]',
  ],
};

export function blockCommentPosting(platform: string): void {
  const selectors = COMMENT_INPUT_SELECTORS[platform];
  if (!selectors) return;

  for (const sel of selectors) {
    const els = document.querySelectorAll<HTMLElement>(sel);
    for (const el of els) {
      if (el.dataset.fwPostBlocked === 'true') continue;
      el.style.display = 'none';
      el.dataset.fwPostBlocked = 'true';
    }
  }
}
