// FeelingWise - Twitter/X engagement control
// Discovers tweet action rows (reply, retweet, like, bookmark) and controls
// them based on mode. Works on both feed timeline and detail/opened-tweet views.
// Mode-polymorphic: child=hide, teen=neutralize counts, adult=pass-through.

import type { AnchorSet, ContainerConstraints, DiscoveredContainer } from './container-discovery';
import { discoverAllContainers } from './container-discovery';
import type { Mode } from '../../types/mode';
import type { VideoControls } from '../../storage/settings';

// ─── Action Row (horizontal bar: reply, retweet, like, bookmark) ───

const ACTION_ROW_ANCHORS: AnchorSet = {
  required: [
    'button[data-testid="reply"]',
    'button[data-testid="retweet"]',
    'button[data-testid="like"]',
  ],
  optional: [
    'button[data-testid="bookmark"]',
  ],
};

const ACTION_ROW_CONSTRAINTS: ContainerConstraints = {
  minRequiredAnchors: 2,
  size: {
    minWidth: 150,
    maxHeight: 100,
    maxViewportWidthRatio: 0.95,
  },
  maxChildCount: 30,
  rejectIfContains: [
    '[data-testid="tweetText"]',
    '[data-testid="tweetPhoto"]',
    '[data-testid="videoPlayer"]',
    '[data-testid="User-Name"]',
    'article',
  ],
  maxWalkDepth: 6,
};

const REQUIRED_BUTTON_SELECTORS = ACTION_ROW_ANCHORS.required;

// ─── CSS style tag ID ───

const ACTION_ROW_CSS_ID = 'fw-twitter-engagement-css';

// ─── Helpers ───

function ensureStyleTag(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

// ─── Surface Detection ───

function detectSurface(): 'feed' | 'detail' {
  if (/^\/[^/]+\/status\/\d+/.test(window.location.pathname)) {
    return 'detail';
  }
  return 'feed';
}

// ─── Primary Discovery: role="group" fast path ───

function discoverActionRowsByGroup(): DiscoveredContainer[] {
  const groups = document.querySelectorAll<HTMLElement>('[role="group"]');
  const results: DiscoveredContainer[] = [];

  for (const group of groups) {
    // Count required anchors inside this group
    let anchorCount = 0;
    for (const sel of REQUIRED_BUTTON_SELECTORS) {
      if (group.querySelector(sel)) anchorCount++;
    }
    if (anchorCount < ACTION_ROW_CONSTRAINTS.minRequiredAnchors) continue;

    // Reject if contains disallowed content
    let rejected = false;
    for (const sel of ACTION_ROW_CONSTRAINTS.rejectIfContains) {
      if (group.querySelector(sel)) {
        rejected = true;
        break;
      }
    }
    if (rejected) continue;

    // Size constraints
    const rect = group.getBoundingClientRect();
    const { size } = ACTION_ROW_CONSTRAINTS;
    if (size.minWidth != null && rect.width < size.minWidth) continue;
    if (size.maxHeight != null && rect.height > size.maxHeight) continue;
    if (
      size.maxViewportWidthRatio != null &&
      window.innerWidth > 0 &&
      rect.width / window.innerWidth > size.maxViewportWidthRatio
    ) continue;

    // Child count check
    if (
      ACTION_ROW_CONSTRAINTS.maxChildCount != null &&
      group.childElementCount > ACTION_ROW_CONSTRAINTS.maxChildCount
    ) continue;

    results.push({
      element: group,
      anchorsFound: anchorCount,
      depth: 0,
      confidence: anchorCount >= REQUIRED_BUTTON_SELECTORS.length ? 'high' : 'medium',
    });
  }

  return results;
}

// ─── Discovery with fallback ───

function discoverActionRows(): DiscoveredContainer[] {
  const byGroup = discoverActionRowsByGroup();
  if (byGroup.length > 0) return byGroup;
  // Fallback to generic walk-up discovery
  return discoverAllContainers(document, ACTION_ROW_ANCHORS, ACTION_ROW_CONSTRAINTS);
}

// ─── Action Row Control ───

const NUMERIC_PATTERN = /^[\d,.KkMm]+$/;

function controlTwitterActionRows(mode: Mode, vc: VideoControls): void {
  const containers = discoverActionRows();

  for (const { element } of containers) {
    const current = element.dataset.fwActionRow;

    if (mode === 'child') {
      if (vc.childBlockActionsPlatforms.twitter) {
        if (current === 'hidden') continue;
        element.dataset.fwActionRow = 'hidden';
        ensureStyleTag(ACTION_ROW_CSS_ID, `
          [data-fw-action-row="hidden"] {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
          }
        `);
        element.style.setProperty('display', 'none', 'important');
      } else if (vc.childHideMetrics) {
        // Keep row visible but hide counts (same as teen behavior)
        if (current === 'neutralized') continue;
        element.dataset.fwActionRow = 'neutralized';

        const buttons = element.querySelectorAll<HTMLElement>(
          'button[data-testid="reply"], button[data-testid="retweet"], ' +
          'button[data-testid="like"], button[data-testid="bookmark"]',
        );
        for (const btn of buttons) {
          const spans = btn.querySelectorAll<HTMLElement>('span');
          for (const span of spans) {
            const text = (span.textContent ?? '').trim();
            if (text.length > 0 && (NUMERIC_PATTERN.test(text) || /^\d/.test(text))) {
              span.style.setProperty('visibility', 'hidden', 'important');
            }
          }
        }

        const analyticsLinks = element.querySelectorAll<HTMLElement>('a[href*="/analytics"]');
        for (const link of analyticsLinks) {
          link.style.setProperty('display', 'none', 'important');
        }
      } else {
        if (current === 'child-pass') continue;
        element.dataset.fwActionRow = 'child-pass';
      }
    } else if (mode === 'teen') {
      if (current === 'neutralized') continue;
      element.dataset.fwActionRow = 'neutralized';

      // Hide numeric counts inside action buttons
      const buttons = element.querySelectorAll<HTMLElement>(
        'button[data-testid="reply"], button[data-testid="retweet"], ' +
        'button[data-testid="like"], button[data-testid="bookmark"]',
      );
      for (const btn of buttons) {
        const spans = btn.querySelectorAll<HTMLElement>('span');
        for (const span of spans) {
          const text = (span.textContent ?? '').trim();
          if (text.length > 0 && (NUMERIC_PATTERN.test(text) || /^\d/.test(text))) {
            span.style.setProperty('visibility', 'hidden', 'important');
          }
        }
      }

      // Hide analytics/views link
      const analyticsLinks = element.querySelectorAll<HTMLElement>('a[href*="/analytics"]');
      for (const link of analyticsLinks) {
        link.style.setProperty('display', 'none', 'important');
      }
    } else {
      // adult
      if (current === 'adult-pass') continue;
      element.dataset.fwActionRow = 'adult-pass';
    }
  }
}

// ─── Cleanup helpers ───

function removeStyleTag(id: string): void {
  document.getElementById(id)?.remove();
}

function resetActionRowMarkers(): void {
  document.querySelectorAll<HTMLElement>('[data-fw-action-row]').forEach(el => {
    delete el.dataset.fwActionRow;
    el.style.removeProperty('display');
    el.style.removeProperty('height');
    el.style.removeProperty('overflow');
    // Restore count visibility for teen mode cleanup
    const buttons = el.querySelectorAll<HTMLElement>(
      'button[data-testid="reply"], button[data-testid="retweet"], ' +
      'button[data-testid="like"], button[data-testid="bookmark"]',
    );
    for (const btn of buttons) {
      btn.querySelectorAll<HTMLElement>('span').forEach(span => {
        span.style.removeProperty('visibility');
      });
    }
    // Restore analytics links
    el.querySelectorAll<HTMLElement>('a[href*="/analytics"]').forEach(link => {
      link.style.removeProperty('display');
    });
  });
}

// ─── Main entry point ───

export function startTwitterEngagementControl(mode: Mode, vc: VideoControls): () => void {
  const surface = detectSurface();
  console.log(`[FW] Twitter engagement control started — surface: ${surface}, mode: ${mode}`);

  let lastUrl = window.location.href;

  function checkUrlAndControl(): void {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      const newSurface = detectSurface();
      console.log(`[FW] Twitter URL changed — surface: ${newSurface}, resetting markers`);
      lastUrl = currentUrl;
      resetActionRowMarkers();
    }
    controlTwitterActionRows(mode, vc);
  }

  // Run immediately
  controlTwitterActionRows(mode, vc);

  // MutationObserver for dynamic content
  const observer = new MutationObserver(() => {
    checkUrlAndControl();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Polling fallback every 2 seconds
  const interval = setInterval(() => {
    checkUrlAndControl();
  }, 2000);

  // Return cleanup function
  return () => {
    observer.disconnect();
    clearInterval(interval);
    removeStyleTag(ACTION_ROW_CSS_ID);
    resetActionRowMarkers();
  };
}
