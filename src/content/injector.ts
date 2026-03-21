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

function replaceText(el: HTMLElement, text: string): void {
  const spans = el.querySelectorAll('span');
  if (spans.length > 0) {
    spans[0].textContent = text;
    for (let i = 1; i < spans.length; i++) {
      spans[i].textContent = '';
    }
  } else {
    el.textContent = text;
  }
}

// ─── CSS injection ───

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
/* Teen mode pill */
div.fw-teen-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  margin-top: 6px !important;
  padding: 3px 10px !important;
  background: rgba(0, 188, 212, 0.1) !important;
  border: 1px solid rgba(0, 188, 212, 0.3) !important;
  border-radius: 14px !important;
  font-size: 11px !important;
  color: #00bcd4 !important;
  cursor: pointer !important;
  user-select: none !important;
  font-family: system-ui, sans-serif !important;
  line-height: 1.4 !important;
  pointer-events: all !important;
}
div.fw-teen-pill:hover {
  background: rgba(0, 188, 212, 0.18) !important;
}

/* Teen mode panel */
div.fw-teen-panel {
  background: #141414 !important;
  border: 1px solid #1e1e1e !important;
  border-radius: 12px !important;
  padding: 16px !important;
  margin-top: 8px !important;
  font-family: system-ui, sans-serif !important;
  font-size: 13px !important;
  color: #f0f0f0 !important;
  line-height: 1.5 !important;
  pointer-events: all !important;
}
div.fw-teen-panel .fw-panel-header {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #00bcd4 !important;
  margin-bottom: 12px !important;
}
div.fw-teen-panel .fw-panel-label {
  font-size: 10px !important;
  color: #888 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  margin-bottom: 4px !important;
  margin-top: 10px !important;
}
div.fw-teen-panel .fw-panel-original {
  color: #888 !important;
  font-size: 12px !important;
  font-style: italic !important;
  padding: 8px !important;
  background: rgba(255,255,255,0.03) !important;
  border-radius: 6px !important;
}
div.fw-teen-panel .fw-panel-technique {
  font-weight: 600 !important;
  color: #f0f0f0 !important;
}
div.fw-teen-panel .fw-panel-explanation {
  color: #ccc !important;
  font-size: 12px !important;
  margin-top: 4px !important;
}
div.fw-teen-panel .fw-panel-question {
  color: #00bcd4 !important;
  font-style: italic !important;
  font-size: 12px !important;
  padding: 8px !important;
  background: rgba(0, 188, 212, 0.06) !important;
  border-radius: 6px !important;
}
button.fw-teen-gotit {
  display: block !important;
  margin: 12px auto 0 !important;
  padding: 6px 20px !important;
  background: rgba(0, 188, 212, 0.15) !important;
  border: 1px solid rgba(0, 188, 212, 0.3) !important;
  border-radius: 8px !important;
  color: #00bcd4 !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  font-family: system-ui, sans-serif !important;
}

/* Adult mode dot */
span.fw-adult-dot {
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  width: 8px !important;
  height: 8px !important;
  border-radius: 50% !important;
  background: #ffab40 !important;
  cursor: pointer !important;
  z-index: 9999 !important;
  pointer-events: all !important;
}
span.fw-adult-dot.fw-seen {
  background: #00bcd4 !important;
}

/* Adult dot tooltip */
div.fw-dot-tooltip {
  position: absolute !important;
  top: 20px !important;
  right: 0 !important;
  background: #141414 !important;
  border: 1px solid #1e1e1e !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  font-size: 11px !important;
  color: #f0f0f0 !important;
  white-space: nowrap !important;
  z-index: 10000 !important;
  pointer-events: none !important;
  font-family: system-ui, sans-serif !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
}

/* Adult analysis panel */
div.fw-adult-panel {
  background: #141414 !important;
  border: 1px solid #1e1e1e !important;
  border-radius: 12px !important;
  padding: 16px !important;
  margin-top: 8px !important;
  font-family: system-ui, sans-serif !important;
  font-size: 13px !important;
  color: #f0f0f0 !important;
  line-height: 1.5 !important;
}
div.fw-adult-panel .fw-panel-header {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #ffab40 !important;
  margin-bottom: 12px !important;
}
div.fw-adult-panel .fw-panel-label {
  font-size: 10px !important;
  color: #888 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  margin-bottom: 4px !important;
  margin-top: 10px !important;
}
div.fw-adult-panel .fw-panel-detail {
  color: #ccc !important;
  font-size: 12px !important;
}
div.fw-adult-panel .fw-panel-actions {
  display: flex !important;
  gap: 8px !important;
  margin-top: 14px !important;
}
button.fw-adult-btn {
  flex: 1 !important;
  padding: 7px 12px !important;
  border-radius: 8px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  font-family: system-ui, sans-serif !important;
  border: none !important;
}
button.fw-adult-btn-primary {
  background: rgba(0, 188, 212, 0.15) !important;
  color: #00bcd4 !important;
  border: 1px solid rgba(0, 188, 212, 0.3) !important;
}
button.fw-adult-btn-secondary {
  background: rgba(255,255,255,0.05) !important;
  color: #888 !important;
  border: 1px solid #1e1e1e !important;
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

    switch (mode) {
      case 'child':
        injectChild(el, neutralized);
        break;
      case 'teen':
        injectTeen(el, neutralized);
        break;
      case 'adult':
        injectAdult(el, neutralized);
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
// Protected + learning. Neutralized by default with pill indicator.

function injectTeen(el: HTMLElement, neutralized: NeutralizedContent): void {
  // Replace text
  replaceText(el, neutralized.rewrittenText);
  el.setAttribute('data-fw-neutralized', 'true');
  addGuard(el, neutralized.rewrittenText);

  // Don't add pill if already there
  if (el.parentElement?.querySelector('.fw-teen-pill')) return;

  const technique = getPrimaryTechnique(neutralized);
  const techniqueName = TECHNIQUE_NAMES[technique];

  // Create pill
  const pill = document.createElement('div');
  pill.className = 'fw-teen-pill';
  pill.textContent = `\u2726 reframed \u00b7 ${techniqueName}`;

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
    panel.innerHTML = `
      <div class="fw-panel-header">\u2726 FeelingWise spotted something</div>
      <div class="fw-panel-label">ORIGINAL</div>
      <div class="fw-panel-original">${escapeHtml(originalText)}</div>
      <div class="fw-panel-label">TECHNIQUE: ${escapeHtml(techniqueName)}</div>
      <div class="fw-panel-explanation">${escapeHtml(TECHNIQUE_EXPLANATIONS[technique])}</div>
      <div class="fw-panel-label">THINK ABOUT IT</div>
      <div class="fw-panel-question">${escapeHtml(TECHNIQUE_QUESTIONS[technique])}</div>
      <button class="fw-teen-gotit">Got it \u2713</button>
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

function injectAdult(el: HTMLElement, neutralized: NeutralizedContent): void {
  // Do NOT replace text — original stays in DOM
  el.setAttribute('data-fw-neutral', neutralized.rewrittenText);
  el.setAttribute('data-fw-flagged', 'true');

  // Find the tweet's article parent
  const article = el.closest('article') as HTMLElement | null;
  if (!article) return;

  // Don't add dot if already there
  if (article.querySelector('.fw-adult-dot')) return;

  // Ensure article is positioned for absolute child
  article.style.position = 'relative';

  const technique = getPrimaryTechnique(neutralized);
  const techniqueName = TECHNIQUE_NAMES[technique];
  const severity = neutralized.analysis.techniques
    .filter(t => t.present)
    .reduce((max, t) => Math.max(max, t.severity), 0);
  const confidence = Math.round(neutralized.analysis.overallConfidence * 100);

  // Create amber dot
  const dot = document.createElement('span');
  dot.className = 'fw-adult-dot';

  // Hover tooltip
  let tooltip: HTMLDivElement | null = null;
  dot.addEventListener('mouseenter', () => {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.className = 'fw-dot-tooltip';
    tooltip.textContent = '\u26a0 Manipulation detected \u00b7 click to analyze';
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
    panel.className = 'fw-adult-panel';
    panel.innerHTML = `
      <div class="fw-panel-header">\u26a0 Manipulation Analysis</div>
      <div class="fw-panel-label">ORIGINAL TEXT</div>
      <div class="fw-panel-detail">${escapeHtml(originalText)}</div>
      <div class="fw-panel-label">DETECTED</div>
      <div class="fw-panel-detail"><strong>${escapeHtml(techniqueName)}</strong> (severity ${severity}/10)</div>
      <div class="fw-panel-detail" style="margin-top:4px !important">${escapeHtml(TECHNIQUE_EXPLANATIONS[technique])}</div>
      <div class="fw-panel-label">CONFIDENCE</div>
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
