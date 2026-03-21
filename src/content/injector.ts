// FeelingWise - DOM injection
// Replaces original post content with neutralized version.
// Mode-aware rendering:
//   child  — invisible replacement (no UI, silent swap)
//   teen   — pill indicator on replaced content
//   adult  — pill indicator + "show original" toggle

import { NeutralizedContent } from '../types/neutralization';
import { Mode } from '../types/mode';

const NEUTRALIZED_ATTR = 'data-fw-neutralized';
const ORIGINAL_ATTR = 'data-fw-original';

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
.fw-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 8px;
  background: rgba(0, 188, 212, 0.08);
  border: 1px solid rgba(0, 188, 212, 0.25);
  border-radius: 12px;
  font-size: 11px;
  color: #00bcd4;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  user-select: none;
}
.fw-pill:hover { background: rgba(0, 188, 212, 0.15); }
.fw-pill-dot { font-size: 10px; }
.fw-pill-text { font-weight: 500; }
.fw-tooltip {
  position: fixed;
  background: #141414;
  border: 1px solid #1e1e1e;
  border-radius: 8px;
  padding: 12px;
  max-width: 280px;
  font-size: 12px;
  color: #f0f0f0;
  z-index: 99999;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
  font-family: system-ui, sans-serif;
}
.fw-tooltip-close {
  position: absolute;
  top: 6px;
  right: 8px;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  font-family: system-ui, sans-serif;
}
.fw-tooltip-label {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.fw-tooltip-section {
  margin-bottom: 8px;
}
.fw-tooltip-section:last-child { margin-bottom: 0; }
.fw-toggle {
  font-size: 11px;
  color: #00bcd4;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-left: 8px;
  font-family: system-ui, sans-serif;
}
`;
  document.head.appendChild(style);
}

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

  if (!el) return;

  _inject(el, result, mode);
}

/**
 * Inject neutralized text directly into a known element.
 */
export function injectIntoElement(
  el: HTMLElement,
  neutralized: NeutralizedContent,
  mode: Mode
): void {
  try {
    _inject(el, neutralized, mode);
  } catch {
    // Consistency rule 13: failure = original stays
  }
}

function _inject(el: HTMLElement, neutralized: NeutralizedContent, mode: Mode): void {
  injectStyles();

  // Preserve original for toggle / audit
  if (!el.hasAttribute(ORIGINAL_ATTR)) {
    el.setAttribute(ORIGINAL_ATTR, el.innerHTML);
  }

  // Replace text content
  el.textContent = neutralized.rewrittenText;
  el.setAttribute(NEUTRALIZED_ATTR, 'true');

  // Mode-specific UI
  switch (mode) {
    case 'child':
      // Rule 12: ZERO visual indication in child mode
      break;

    case 'teen':
      _attachPill(el, neutralized);
      break;

    case 'adult':
      _attachPill(el, neutralized);
      _attachToggle(el);
      break;
  }
}

function _attachPill(el: HTMLElement, neutralized: NeutralizedContent): void {
  if (el.parentElement?.querySelector('.fw-pill')) return;

  const techniques = neutralized.analysis.techniques
    .filter(t => t.present)
    .map(t => t.technique);

  const pill = document.createElement('div');
  pill.className = 'fw-pill';
  pill.setAttribute('data-fw-techniques', techniques.join(', '));
  pill.innerHTML = `<span class="fw-pill-dot">\u2726</span><span class="fw-pill-text">neutralized</span>`;

  const originalText = el.getAttribute(ORIGINAL_ATTR) ?? '';

  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    // Remove any existing tooltip
    document.querySelector('.fw-tooltip')?.remove();

    const rect = pill.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = 'fw-tooltip';

    const preview = originalText.replace(/<[^>]*>/g, '').slice(0, 80);

    tooltip.innerHTML = `
      <button class="fw-tooltip-close">\u00d7</button>
      <div class="fw-tooltip-section">
        <div class="fw-tooltip-label">Original</div>
        <div>${preview}${originalText.length > 80 ? '...' : ''}</div>
      </div>
      <div class="fw-tooltip-section">
        <div class="fw-tooltip-label">Detected</div>
        <div>${techniques.join(', ') || 'none'}</div>
      </div>
    `;

    // Position near pill
    tooltip.style.top = `${rect.bottom + 6}px`;
    tooltip.style.left = `${Math.max(8, rect.left - 40)}px`;

    document.body.appendChild(tooltip);

    // Close on button click
    tooltip.querySelector('.fw-tooltip-close')?.addEventListener('click', () => tooltip.remove());

    // Close on outside click
    const closeOnOutside = (ev: MouseEvent) => {
      if (!tooltip.contains(ev.target as Node)) {
        tooltip.remove();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
  });

  el.parentElement?.appendChild(pill);
}

function _attachToggle(el: HTMLElement): void {
  if (el.parentElement?.querySelector('.fw-toggle')) return;

  const btn = document.createElement('button');
  btn.className = 'fw-toggle';
  btn.textContent = 'Show original';

  let showingOriginal = false;

  btn.addEventListener('click', () => {
    const original = el.getAttribute(ORIGINAL_ATTR);
    if (!original) return;

    if (showingOriginal) {
      el.textContent = el.getAttribute('data-fw-neutralized-text') ?? '';
      btn.textContent = 'Show original';
      showingOriginal = false;
    } else {
      el.setAttribute('data-fw-neutralized-text', el.textContent ?? '');
      el.innerHTML = original;
      btn.textContent = 'Show neutralized';
      showingOriginal = true;
    }
  });

  el.parentElement?.appendChild(btn);
}
