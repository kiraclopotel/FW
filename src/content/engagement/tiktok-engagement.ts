// FeelingWise - TikTok engagement control
// Uses container-discovery to find and control action rails and comment sections.
// Mode-polymorphic: child=hide, teen=neutralize counts, adult=pass-through.

import type { AnchorSet, ContainerConstraints } from './container-discovery';
import { discoverContainer, discoverAllContainers } from './container-discovery';
import type { Mode } from '../../types/mode';
import type { VideoControls } from '../../storage/settings';

// ─── Action Rail (vertical strip: like, comment, share, bookmark) ───

const ACTION_RAIL_ANCHORS: AnchorSet = {
  required: [
    '[data-e2e="like-icon"]',
    '[data-e2e="comment-icon"]',
    '[data-e2e="share-icon"]',
  ],
  optional: [
    '[data-e2e="like-count"]',
    '[data-e2e="comment-count"]',
    '[data-e2e="share-count"]',
    '[data-e2e="undefined-count"]',
  ],
};

const ACTION_RAIL_CONSTRAINTS: ContainerConstraints = {
  minRequiredAnchors: 2,
  size: {
    minWidth: 30,
    maxWidth: 120,
    minHeight: 100,
    maxHeight: 600,
  },
  maxChildCount: 100,
  rejectIfContains: [
    '[data-e2e="feed-video"]',
    '[data-e2e="video-desc"]',
    '[data-e2e="browse-video-desc"]',
    'video',
  ],
  maxWalkDepth: 8,
};

// ─── Comment Section ───

const COMMENT_SECTION_ANCHORS: AnchorSet = {
  required: [
    '[data-e2e^="comment-level-"]',
  ],
  optional: [
    '[data-e2e="comment-username-1"]',
    '[data-e2e="comment-input"]',
    '[data-e2e="comment-post"]',
    '[data-e2e="comment-text-1"]',
  ],
};

const COMMENT_SECTION_CONSTRAINTS: ContainerConstraints = {
  minRequiredAnchors: 1,
  size: {
    minHeight: 80,
  },
  rejectIfContains: [
    'video',
    '[data-e2e="feed-video"]',
  ],
  maxWalkDepth: 10,
};

// ─── CSS style tag IDs ───

const ACTION_RAIL_CSS_ID = 'fw-tiktok-action-rail-css';
const COMMENT_SECTION_CSS_ID = 'fw-tiktok-comment-section-css';
const POST_BLOCK_CSS_ID = 'fw-tiktok-post-block-css';

// ─── Helpers ───

function ensureStyleTag(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

const COUNT_SELECTORS = [
  '[data-e2e="like-count"]',
  '[data-e2e="comment-count"]',
  '[data-e2e="share-count"]',
  '[data-e2e="undefined-count"]',
];

// ─── Action Rail Control ───

function controlActionRail(mode: Mode, vc: VideoControls): void {
  const containers = discoverAllContainers(document, ACTION_RAIL_ANCHORS, ACTION_RAIL_CONSTRAINTS);

  for (const { element } of containers) {
    const current = element.dataset.fwActionRail;

    if (mode === 'child') {
      const hideRail = vc.childBlockActions && vc.childBlockActionsPlatforms.tiktok;
      if (hideRail) {
        if (current === 'hidden') continue;
        element.dataset.fwActionRail = 'hidden';
        ensureStyleTag(ACTION_RAIL_CSS_ID, `
          [data-fw-action-rail="hidden"] {
            display: none !important;
            visibility: hidden !important;
          }
        `);
        element.style.setProperty('display', 'none', 'important');
      } else if (vc.childHideMetrics) {
        // Keep rail visible but hide counts (same as teen behavior)
        if (current === 'neutralized') continue;
        element.dataset.fwActionRail = 'neutralized';
        for (const sel of COUNT_SELECTORS) {
          element.querySelectorAll<HTMLElement>(sel).forEach(el => {
            el.style.setProperty('visibility', 'hidden', 'important');
          });
        }
      } else {
        if (current === 'child-pass') continue;
        element.dataset.fwActionRail = 'child-pass';
      }
    } else if (mode === 'teen') {
      if (current === 'neutralized') continue;
      element.dataset.fwActionRail = 'neutralized';
      for (const sel of COUNT_SELECTORS) {
        element.querySelectorAll<HTMLElement>(sel).forEach(el => {
          el.style.setProperty('visibility', 'hidden', 'important');
        });
      }
    } else {
      // adult mode
      if (vc.adultHideMetrics) {
        if (current === 'neutralized') continue;
        element.dataset.fwActionRail = 'neutralized';
        for (const sel of COUNT_SELECTORS) {
          element.querySelectorAll<HTMLElement>(sel).forEach(el => {
            el.style.setProperty('visibility', 'hidden', 'important');
          });
        }
      } else {
        if (current === 'adult-pass') continue;
        element.dataset.fwActionRail = 'adult-pass';
      }
    }
  }
}

// ─── Comment Section Control ───

function controlCommentSection(mode: Mode, vc: VideoControls): void {
  const result = discoverContainer(document, COMMENT_SECTION_ANCHORS, COMMENT_SECTION_CONSTRAINTS);
  if (!result) return;

  const { element } = result;
  const current = element.dataset.fwCommentSection;

  if (mode === 'child') {
    if (vc.childCommentMode === 'educational') {
      // Mark for discovery but do NOT hide — video pipeline injects educational overlay
      if (current === 'educational') return;
      element.dataset.fwCommentSection = 'educational';
    } else {
      // childCommentMode === 'hidden' — hide entirely
      if (current === 'hidden') return;
      element.dataset.fwCommentSection = 'hidden';
      ensureStyleTag(COMMENT_SECTION_CSS_ID, `
        [data-fw-comment-section="hidden"] {
          display: none !important;
          visibility: hidden !important;
        }
      `);
      element.style.setProperty('display', 'none', 'important');
    }
  } else if (mode === 'teen') {
    if (current === 'teen-discovered') return;
    element.dataset.fwCommentSection = 'teen-discovered';
    // Do NOT hide — video pipeline handles teen comment rewriting separately
  } else {
    // adult mode
    if (vc.adultBlockComments) {
      if (current === 'hidden') return;
      element.dataset.fwCommentSection = 'hidden';
      ensureStyleTag(COMMENT_SECTION_CSS_ID, `
        [data-fw-comment-section="hidden"] {
          display: none !important;
          visibility: hidden !important;
        }
      `);
      element.style.setProperty('display', 'none', 'important');
    } else {
      if (current === 'adult-pass') return;
      element.dataset.fwCommentSection = 'adult-pass';
    }
  }
}

// ─── Comment Posting Block (child only) ───

function blockTikTokCommentPosting(): void {
  const directSelectors = [
    '[data-e2e="comment-input"]',
    '[data-e2e="comment-post"]',
  ];

  let found = false;

  for (const sel of directSelectors) {
    document.querySelectorAll<HTMLElement>(sel).forEach(el => {
      if (el.dataset.fwPostBlocked === 'true') return;
      el.dataset.fwPostBlocked = 'true';
      el.style.setProperty('display', 'none', 'important');
      found = true;
    });
  }

  // Find contenteditable elements near comment context
  const commentSection = document.querySelector('[data-fw-comment-section]');
  if (commentSection) {
    commentSection.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach(el => {
      if (el.dataset.fwPostBlocked === 'true') return;
      el.dataset.fwPostBlocked = 'true';
      el.style.setProperty('display', 'none', 'important');
      found = true;
    });
  }

  // Structural fallback: find any contenteditable/textarea with comment-related placeholder
  if (!found) {
    const editables = document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"], textarea',
    );
    for (const el of editables) {
      if (el.dataset.fwPostBlocked === 'true') continue;
      const text = (
        el.getAttribute('placeholder') ??
        el.getAttribute('aria-label') ??
        el.getAttribute('data-placeholder') ??
        el.textContent ?? ''
      ).toLowerCase();

      if (!/comment|comentariu|reply|adaugă/.test(text)) continue;

      // Walk up to find the input bar container (full-width, short height)
      let target: HTMLElement = el;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.6 && rect.height < 80) {
          target = parent;
          break;
        }
        parent = parent.parentElement;
      }

      target.dataset.fwPostBlocked = 'true';
      target.style.setProperty('display', 'none', 'important');
      found = true;
      break;
    }
  }

  if (found) {
    ensureStyleTag(POST_BLOCK_CSS_ID, `
      [data-fw-post-blocked="true"] {
        display: none !important;
      }
    `);
  }
}

// ─── Cleanup helpers ───

function removeStyleTag(id: string): void {
  document.getElementById(id)?.remove();
}

function resetDataAttributes(): void {
  document.querySelectorAll<HTMLElement>('[data-fw-action-rail]').forEach(el => {
    delete el.dataset.fwActionRail;
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    // Restore count visibility for teen mode cleanup
    for (const sel of COUNT_SELECTORS) {
      el.querySelectorAll<HTMLElement>(sel).forEach(count => {
        count.style.removeProperty('visibility');
      });
    }
  });
  document.querySelectorAll<HTMLElement>('[data-fw-comment-section]').forEach(el => {
    delete el.dataset.fwCommentSection;
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
  });
  document.querySelectorAll<HTMLElement>('[data-fw-post-blocked]').forEach(el => {
    delete el.dataset.fwPostBlocked;
    el.style.removeProperty('display');
  });
}

// ─── Main entry point ───

export function startTikTokEngagementControl(mode: Mode, vc: VideoControls): () => void {
  const shouldBlockPosting = mode === 'child' && vc.childBlockPosting;

  function runAll(): void {
    controlActionRail(mode, vc);
    controlCommentSection(mode, vc);
    if (shouldBlockPosting) {
      blockTikTokCommentPosting();
    }
  }

  // Run immediately
  runAll();

  // MutationObserver for dynamic content
  const observer = new MutationObserver(() => runAll());
  observer.observe(document.body, { childList: true, subtree: true });

  // Polling fallback every 2 seconds
  const interval = setInterval(runAll, 2000);

  // Return cleanup function
  return () => {
    observer.disconnect();
    clearInterval(interval);
    removeStyleTag(ACTION_RAIL_CSS_ID);
    removeStyleTag(COMMENT_SECTION_CSS_ID);
    removeStyleTag(POST_BLOCK_CSS_ID);
    resetDataAttributes();
  };
}
