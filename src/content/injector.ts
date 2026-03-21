// FeelingWise - DOM injection (complete rewrite)
// Three fundamentally different mode behaviors:
//   child  — invisible replacement (zero UI)
//   teen   — protected + learning (pill + expandable panel)
//   adult  — transparency first (original stays, amber dot indicator)

import { NeutralizedContent } from '../types/neutralization';
import { TechniqueName } from '../types/analysis';
import { Mode } from '../types/mode';

// ─── Technique display maps ───

const TECHNIQUE_NAMES: Record<TechniqueName, string> = {
  'fear-appeal': 'Fear Tactic',
  'shame-attack': 'Shame Attack',
  'anger-trigger': 'Outrage Bait',
  'false-urgency': 'Fake Urgency',
  'bandwagon': 'Crowd Pressure',
  'scapegoating': 'Blame Shifting',
  'fomo': 'Fear of Missing Out',
  'toxic-positivity': 'Toxic Positivity',
  'misleading-format': 'Visual Manipulation',
  'combined': 'Multiple Techniques',
};

const TECHNIQUE_EXPLANATIONS: Record<TechniqueName, string> = {
  'fear-appeal': 'This post tries to frighten you so you don\'t think clearly about the claim.',
  'shame-attack': 'This post tries to make you feel bad about yourself to change your behavior.',
  'anger-trigger': 'This post uses inflammatory language to make you angry before you can think.',
  'false-urgency': 'This post creates fake time pressure so you act before you think.',
  'bandwagon': 'This post falsely claims everyone agrees, to make you feel left out if you don\'t.',
  'scapegoating': 'This post blames a group for complex problems to give you a simple enemy.',
  'fomo': 'This post manufactures exclusivity so you fear missing out on something.',
  'toxic-positivity': 'This post dismisses real feelings by forcing artificial optimism.',
  'misleading-format': 'This post uses visual tricks like CAPS to manipulate your attention.',
  'combined': 'This post uses multiple manipulation techniques at the same time.',
};

const TECHNIQUE_QUESTIONS: Record<TechniqueName, string> = {
  'fear-appeal': 'What would you think of this claim if the scary words were removed?',
  'shame-attack': 'Would you accept this opinion from a friend who said it kindly?',
  'anger-trigger': 'Is this making you angry at the argument or at a person?',
  'false-urgency': 'Would this still feel urgent if you waited 24 hours?',
  'bandwagon': 'Do you actually know anyone who agrees with this?',
  'scapegoating': 'Is one group really responsible for this whole problem?',
  'fomo': 'Would you actually miss anything important if you ignored this?',
  'toxic-positivity': 'Is it okay to feel the way you feel right now?',
  'misleading-format': 'What does this post actually say without the formatting?',
  'combined': 'How many different ways is this post trying to affect you?',
};

// ─── MutationObserver guards ───

const guards = new WeakMap<HTMLElement, MutationObserver>();
const guardOrder: HTMLElement[] = [];
const MAX_GUARDS = 50;

function addGuard(el: HTMLElement, expectedText: string): void {
  // Remove existing guard if any
  const existing = guards.get(el);
  if (existing) existing.disconnect();

  const observer = new MutationObserver(() => {
    if (el.textContent !== expectedText) {
      replaceText(el, expectedText);
    }
  });

  observer.observe(el, { characterData: true, childList: true, subtree: true });
  guards.set(el, observer);
  guardOrder.push(el);

  // Enforce max guard limit
  while (guardOrder.length > MAX_GUARDS) {
    const oldest = guardOrder.shift()!;
    const oldObserver = guards.get(oldest);
    if (oldObserver) {
      oldObserver.disconnect();
      guards.delete(oldest);
    }
  }
}

// ─── Span-aware text replacement ───
// Twitter tweets use [data-testid="tweetText"] which contains multiple
// <span> elements for text segments, plus <a> for links/mentions and
// <img> for emoji. We preserve the DOM structure by placing text in the
// first text-bearing span and hiding extra spans, while keeping non-text
// nodes (emoji images, etc.) in place to avoid breaking layout.

function replaceText(el: HTMLElement, text: string): void {
  // Pause guard during our own mutation to avoid re-entry
  const existingGuard = guards.get(el);
  if (existingGuard) existingGuard.disconnect();

  try {
    const children = Array.from(el.childNodes);
    if (children.length === 0) {
      el.textContent = text;
      return;
    }

    // Find all direct child spans and text nodes (Twitter's structure)
    let placed = false;
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!placed) {
          child.textContent = text;
          placed = true;
        } else {
          child.textContent = '';
        }
      } else if (child instanceof HTMLElement) {
        if (child.tagName === 'SPAN') {
          if (!placed) {
            child.textContent = text;
            child.style.display = '';
            placed = true;
          } else {
            // Hide extra spans rather than emptying, to preserve layout space
            child.style.display = 'none';
          }
        } else if (child.tagName === 'A') {
          // Hide link spans (mentions, hashtags, urls) from original
          child.style.display = 'none';
        } else if (child.tagName === 'IMG') {
          // Hide emoji images from original text
          child.style.display = 'none';
        }
      }
    }

    // If no suitable child was found, fall back to textContent
    if (!placed) {
      el.textContent = text;
    }
  } finally {
    // Re-observe if we had a guard
    if (existingGuard) {
      existingGuard.observe(el, { characterData: true, childList: true, subtree: true });
    }
  }
}

// ─── Viewport detection ───

function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

// ─── CSS injection ───

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
/* Teen mode pill — compact, inline, subtle footnote */
span.fw-teen-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 3px !important;
  margin-top: 4px !important;
  padding: 1px 7px !important;
  background: transparent !important;
  border: none !important;
  border-radius: 3px !important;
  font-size: 12px !important;
  color: rgba(0, 188, 212, 0.6) !important;
  cursor: pointer !important;
  user-select: none !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  line-height: 1.3 !important;
  pointer-events: all !important;
  transition: color 0.15s ease !important;
  vertical-align: baseline !important;
}
span.fw-teen-pill:hover {
  color: rgba(0, 188, 212, 0.9) !important;
}
span.fw-teen-pill .fw-pill-technique {
  display: none !important;
  font-size: 11px !important;
  opacity: 0.7 !important;
}
span.fw-teen-pill:hover .fw-pill-technique {
  display: inline !important;
}

/* Teen mode panel — Twitter-native dark theme */
div.fw-teen-panel {
  background: rgb(22, 24, 28) !important;
  border: 1px solid rgb(47, 51, 54) !important;
  border-radius: 16px !important;
  padding: 12px 16px !important;
  margin-top: 8px !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px !important;
  color: rgb(231, 233, 234) !important;
  line-height: 1.4 !important;
  pointer-events: all !important;
}
div.fw-teen-panel .fw-panel-header {
  font-size: 15px !important;
  font-weight: 700 !important;
  color: rgb(231, 233, 234) !important;
  margin-bottom: 8px !important;
}
div.fw-teen-panel .fw-panel-label {
  font-size: 13px !important;
  color: rgb(113, 118, 123) !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  margin-bottom: 2px !important;
  margin-top: 10px !important;
  font-weight: 700 !important;
}
div.fw-teen-panel .fw-panel-original {
  color: rgb(113, 118, 123) !important;
  font-size: 14px !important;
  font-style: italic !important;
  padding: 8px 12px !important;
  background: rgba(255,255,255,0.03) !important;
  border-radius: 12px !important;
  margin-top: 4px !important;
}
div.fw-teen-panel .fw-panel-technique {
  font-weight: 700 !important;
  color: rgb(231, 233, 234) !important;
}
div.fw-teen-panel .fw-panel-explanation {
  color: rgb(139, 152, 165) !important;
  font-size: 14px !important;
  margin-top: 4px !important;
}
div.fw-teen-panel .fw-panel-question {
  color: rgb(29, 155, 240) !important;
  font-style: normal !important;
  font-size: 14px !important;
  padding: 8px 12px !important;
  background: rgba(29, 155, 240, 0.08) !important;
  border-radius: 12px !important;
  margin-top: 4px !important;
}
button.fw-teen-gotit {
  display: block !important;
  margin: 10px auto 0 !important;
  padding: 6px 18px !important;
  background: transparent !important;
  border: 1px solid rgb(47, 51, 54) !important;
  border-radius: 9999px !important;
  color: rgb(231, 233, 234) !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  transition: background 0.15s ease !important;
}
button.fw-teen-gotit:hover {
  background: rgba(231, 233, 234, 0.1) !important;
}

/* Adult mode dot — positioned to avoid Twitter's 3-dot menu (top-right) */
span.fw-adult-dot {
  position: absolute !important;
  bottom: 8px !important;
  right: 12px !important;
  width: 6px !important;
  height: 6px !important;
  border-radius: 50% !important;
  background: #ffab40 !important;
  cursor: pointer !important;
  z-index: 2 !important;
  pointer-events: all !important;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.8) !important;
  transition: transform 0.15s ease !important;
}
span.fw-adult-dot:hover {
  transform: scale(1.6) !important;
}
span.fw-adult-dot.fw-seen {
  background: #00bcd4 !important;
}

/* Adult dot tooltip */
div.fw-dot-tooltip {
  position: absolute !important;
  bottom: 14px !important;
  right: 0 !important;
  background: rgb(22, 24, 28) !important;
  border: 1px solid rgb(47, 51, 54) !important;
  border-radius: 8px !important;
  padding: 4px 8px !important;
  font-size: 12px !important;
  color: rgb(231, 233, 234) !important;
  white-space: nowrap !important;
  z-index: 3 !important;
  pointer-events: none !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
}

/* Adult analysis panel */
div.fw-adult-panel {
  background: rgb(22, 24, 28) !important;
  border: 1px solid rgb(47, 51, 54) !important;
  border-radius: 16px !important;
  padding: 12px 16px !important;
  margin-top: 8px !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px !important;
  color: rgb(231, 233, 234) !important;
  line-height: 1.4 !important;
}
div.fw-adult-panel .fw-panel-header {
  font-size: 15px !important;
  font-weight: 700 !important;
  color: #ffab40 !important;
  margin-bottom: 8px !important;
}
div.fw-adult-panel .fw-panel-label {
  font-size: 13px !important;
  color: rgb(113, 118, 123) !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  margin-bottom: 2px !important;
  margin-top: 10px !important;
  font-weight: 700 !important;
}
div.fw-adult-panel .fw-panel-detail {
  color: rgb(139, 152, 165) !important;
  font-size: 14px !important;
}
div.fw-adult-panel .fw-panel-actions {
  display: flex !important;
  gap: 8px !important;
  margin-top: 12px !important;
}
button.fw-adult-btn {
  flex: 1 !important;
  padding: 8px 16px !important;
  border-radius: 9999px !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  border: none !important;
  transition: background 0.15s ease !important;
}
button.fw-adult-btn-primary {
  background: rgba(29, 155, 240, 0.15) !important;
  color: rgb(29, 155, 240) !important;
  border: 1px solid rgba(29, 155, 240, 0.3) !important;
}
button.fw-adult-btn-primary:hover {
  background: rgba(29, 155, 240, 0.25) !important;
}
button.fw-adult-btn-secondary {
  background: transparent !important;
  color: rgb(113, 118, 123) !important;
  border: 1px solid rgb(47, 51, 54) !important;
}
button.fw-adult-btn-secondary:hover {
  background: rgba(231, 233, 234, 0.1) !important;
}

/* Fade-in for visible injection */
@keyframes fw-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.fw-animate-in {
  animation: fw-fade-in 0.2s ease-out !important;
}
`;
  document.head.appendChild(style);
}

// ─── Helper ───

function getPrimaryTechnique(neutralized: NeutralizedContent): TechniqueName {
  const present = neutralized.analysis.techniques.filter(t => t.present);
  if (present.length === 0) return 'combined';
  // If multiple, use 'combined'; otherwise use the single one
  if (present.length > 1) return 'combined';
  return present[0].technique;
}

// ─── Public API ───

export function injectIntoElement(
  el: HTMLElement,
  neutralized: NeutralizedContent,
  mode: Mode,
): void {
  try {
    injectStyles();

    // Store original
    if (!el.hasAttribute('data-fw-original')) {
      el.setAttribute('data-fw-original', el.innerHTML);
    }

    const visible = isInViewport(el);

    switch (mode) {
      case 'child':
        injectChild(el, neutralized);
        break;
      case 'teen':
        injectTeen(el, neutralized, visible);
        break;
      case 'adult':
        injectAdult(el, neutralized, visible);
        break;
    }
  } catch {
    // Consistency rule 13: failure = original stays
  }
}

// For backward compat with replaceWithNeutralized
export function replaceWithNeutralized(
  result: NeutralizedContent,
  mode: Mode,
): void {
  const el = document.querySelector<HTMLElement>(
    `[data-fw-id="${result.postId}"]`,
  );
  if (!el) return;
  injectIntoElement(el, result, mode);
}

// ─── CHILD MODE ───
// INVISIBLE. Zero visual indication. Silent text swap.

function injectChild(el: HTMLElement, neutralized: NeutralizedContent): void {
  replaceText(el, neutralized.rewrittenText);
  el.setAttribute('data-fw-neutralized', 'true');
  addGuard(el, neutralized.rewrittenText);
}

// ─── TEEN MODE ───
// Protected + learning. Neutralized by default with compact pill indicator.

function injectTeen(el: HTMLElement, neutralized: NeutralizedContent, visible: boolean): void {
  // Replace text
  replaceText(el, neutralized.rewrittenText);
  el.setAttribute('data-fw-neutralized', 'true');
  addGuard(el, neutralized.rewrittenText);

  // Don't add pill if already there
  if (el.parentElement?.querySelector('.fw-teen-pill')) return;

  const technique = getPrimaryTechnique(neutralized);
  const techniqueName = TECHNIQUE_NAMES[technique];

  // Create compact inline pill — just "✦ reframed", technique on hover
  const pill = document.createElement('span');
  pill.className = 'fw-teen-pill';
  if (visible) pill.classList.add('fw-animate-in');

  const label = document.createTextNode('\u2726 reframed');
  const techSpan = document.createElement('span');
  techSpan.className = 'fw-pill-technique';
  techSpan.textContent = ` \u00b7 ${techniqueName}`;

  pill.appendChild(label);
  pill.appendChild(techSpan);

  pill.addEventListener('click', (e) => {
    e.stopPropagation();

    // Toggle panel
    const existingPanel = el.parentElement?.querySelector('.fw-teen-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    const originalText = el.getAttribute('data-fw-original')?.replace(/<[^>]*>/g, '') ?? '';

    const panel = document.createElement('div');
    panel.className = 'fw-teen-panel';
    if (visible) panel.classList.add('fw-animate-in');
    panel.innerHTML = `
      <div class="fw-panel-header">\u2726 FeelingWise spotted something</div>
      <div class="fw-panel-label">Original</div>
      <div class="fw-panel-original">${escapeHtml(originalText)}</div>
      <div class="fw-panel-label">${escapeHtml(techniqueName)}</div>
      <div class="fw-panel-explanation">${escapeHtml(TECHNIQUE_EXPLANATIONS[technique])}</div>
      <div class="fw-panel-label">Think about it</div>
      <div class="fw-panel-question">${escapeHtml(TECHNIQUE_QUESTIONS[technique])}</div>
      <button class="fw-teen-gotit">Got it</button>
    `;

    panel.querySelector('.fw-teen-gotit')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      panel.remove();
    });

    // Insert panel after the pill
    pill.insertAdjacentElement('afterend', panel);
  });

  el.parentElement?.appendChild(pill);
}

// ─── ADULT MODE ───
// Transparency first. Original stays. Amber dot indicator.

function injectAdult(el: HTMLElement, neutralized: NeutralizedContent, visible: boolean): void {
  // Do NOT replace text — original stays in DOM
  el.setAttribute('data-fw-neutral', neutralized.rewrittenText);
  el.setAttribute('data-fw-flagged', 'true');

  // Find the tweet's article parent
  const article = el.closest('article') as HTMLElement | null;
  if (!article) return;

  // Don't add dot if already there
  if (article.querySelector('.fw-adult-dot')) return;

  // Ensure article is positioned for absolute child
  if (getComputedStyle(article).position === 'static') {
    article.style.position = 'relative';
  }

  const technique = getPrimaryTechnique(neutralized);
  const techniqueName = TECHNIQUE_NAMES[technique];
  const severity = neutralized.analysis.techniques
    .filter(t => t.present)
    .reduce((max, t) => Math.max(max, t.severity), 0);
  const confidence = Math.round(neutralized.analysis.overallConfidence * 100);

  // Create amber dot — positioned bottom-right to avoid Twitter's 3-dot menu
  const dot = document.createElement('span');
  dot.className = 'fw-adult-dot';
  if (visible) dot.classList.add('fw-animate-in');

  // Hover tooltip
  let tooltip: HTMLDivElement | null = null;
  dot.addEventListener('mouseenter', () => {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.className = 'fw-dot-tooltip';
    tooltip.textContent = 'Click to analyze';
    dot.appendChild(tooltip);
  });
  dot.addEventListener('mouseleave', () => {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  });

  // Click to show analysis panel
  dot.addEventListener('click', (e) => {
    e.stopPropagation();

    // Toggle panel
    const existingPanel = article.querySelector('.fw-adult-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    const originalText = el.getAttribute('data-fw-original')?.replace(/<[^>]*>/g, '') ?? '';

    const panel = document.createElement('div');
    panel.className = 'fw-adult-panel fw-animate-in';
    panel.innerHTML = `
      <div class="fw-panel-header">\u26a0 Manipulation Analysis</div>
      <div class="fw-panel-label">Original text</div>
      <div class="fw-panel-detail">${escapeHtml(originalText)}</div>
      <div class="fw-panel-label">Detected</div>
      <div class="fw-panel-detail"><strong>${escapeHtml(techniqueName)}</strong> (severity ${severity}/10)</div>
      <div class="fw-panel-detail" style="margin-top:4px !important">${escapeHtml(TECHNIQUE_EXPLANATIONS[technique])}</div>
      <div class="fw-panel-label">Confidence</div>
      <div class="fw-panel-detail">${confidence}%</div>
      <div class="fw-panel-actions">
        <button class="fw-adult-btn fw-adult-btn-primary fw-see-neutral">See neutralized</button>
        <button class="fw-adult-btn fw-adult-btn-secondary fw-dismiss">Dismiss</button>
      </div>
    `;

    // "See neutralized" button
    panel.querySelector('.fw-see-neutral')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      replaceText(el, neutralized.rewrittenText);
      el.setAttribute('data-fw-neutralized', 'true');
      dot.classList.add('fw-seen');
      addGuard(el, neutralized.rewrittenText);
      panel.remove();
    });

    // "Dismiss" button
    panel.querySelector('.fw-dismiss')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      panel.remove();
    });

    // Insert panel after the tweet text element
    el.insertAdjacentElement('afterend', panel);
  });

  article.appendChild(dot);
}

// ─── Utilities ───

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
