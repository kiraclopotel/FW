// FeelingWise - DOM injection
// Replaces original post content with neutralized version.
// Mode-aware rendering:
//   child  — invisible replacement (no UI, silent swap)
//   teen   — badge indicator on replaced content
//   adult  — "show original" toggle available
//
// Phase 2: infrastructure only. replaceWithNeutralized() is wired up in Phase 4.

import { NeutralizedContent } from '../types/neutralization';
import { Mode } from '../types/mode';

const BADGE_CLASS = 'fw-badge';
const TOGGLE_CLASS = 'fw-toggle';
const NEUTRALIZED_ATTR = 'data-fw-neutralized';
const ORIGINAL_ATTR = 'data-fw-original';

/**
 * Inject neutralized content into the DOM, styled according to the active mode.
 * Consistency rule 13: any DOM error silently passes through (original shown).
 */
export function replaceWithNeutralized(
  result: NeutralizedContent,
  mode: Mode
): void {
  const el = result.analysis.postId
    ? document.querySelector<HTMLElement>(
        `[data-fw-id="${result.postId}"]`
      )
    : null;

  // We primarily use the domRef stored on the NeutralizedContent's analysis.
  // For Phase 2 we accept a WeakRef via the caller; here we look up by postId
  // as a fallback.  The real wiring happens in Phase 4.
  if (!el) return;

  _inject(el, result.rewrittenText, mode);
}

/**
 * Inject neutralized text directly into a known element.
 * Used by Phase 4 pipeline after it has the DOM reference.
 */
export function injectIntoElement(
  el: HTMLElement,
  neutralized: NeutralizedContent,
  mode: Mode
): void {
  try {
    _inject(el, neutralized.rewrittenText, mode);
  } catch {
    // Consistency rule 13: failure = original stays
  }
}

function _inject(el: HTMLElement, newText: string, mode: Mode): void {
  // Preserve original for toggle / audit
  if (!el.hasAttribute(ORIGINAL_ATTR)) {
    el.setAttribute(ORIGINAL_ATTR, el.innerHTML);
  }

  // Replace text content
  el.textContent = newText;
  el.setAttribute(NEUTRALIZED_ATTR, 'true');

  // Mode-specific UI
  switch (mode) {
    case 'child':
      // Rule 12: ZERO visual indication in child mode
      break;

    case 'teen':
      _attachBadge(el);
      break;

    case 'adult':
      _attachToggle(el);
      break;
  }
}

function _attachBadge(el: HTMLElement): void {
  if (el.parentElement?.querySelector(`.${BADGE_CLASS}`)) return;

  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;
  badge.textContent = '✦ neutralized';
  badge.style.cssText =
    'font-size:10px;color:#888;margin-left:6px;font-style:italic;';

  el.parentElement?.appendChild(badge);
}

function _attachToggle(el: HTMLElement): void {
  if (el.parentElement?.querySelector(`.${TOGGLE_CLASS}`)) return;

  const btn = document.createElement('button');
  btn.className = TOGGLE_CLASS;
  btn.textContent = 'Show original';
  btn.style.cssText =
    'font-size:11px;color:#1d9bf0;background:none;border:none;cursor:pointer;padding:0;margin-left:8px;';

  let showingOriginal = false;

  btn.addEventListener('click', () => {
    const original = el.getAttribute(ORIGINAL_ATTR);
    if (!original) return;

    if (showingOriginal) {
      el.textContent = el.getAttribute('data-fw-neutralized-text') ?? '';
      btn.textContent = 'Show original';
      showingOriginal = false;
    } else {
      // Save neutralized text before swapping
      el.setAttribute('data-fw-neutralized-text', el.textContent ?? '');
      el.innerHTML = original;
      btn.textContent = 'Show neutralized';
      showingOriginal = true;
    }
  });

  el.parentElement?.appendChild(btn);
}
