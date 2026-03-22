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
  'fear-appeal': 'This post amplifies fear beyond what the facts support, trying to make you act from panic rather than from understanding. Your brain\'s amygdala treats fear signals as emergencies, shutting down your prefrontal cortex — the part that evaluates evidence. That\'s why scared people make fast, bad decisions.',
  'shame-attack': 'This post attacks someone\'s character or identity instead of addressing their actions or policies. It wants you to feel contempt, not think critically. Your brain processes personal attacks like physical pain — once you feel that sting, you stop evaluating the argument and start defending or attacking back.',
  'anger-trigger': 'This post uses dehumanizing or inflammatory words designed to make you angry before you evaluate the actual claim. Angry people share more and think less. Anger narrows your attention to the target and floods your brain with cortisol, making you feel certain even when you shouldn\'t be.',
  'false-urgency': 'This post creates artificial time pressure — MUST WATCH, ACT NOW — to make you engage before you think about whether it matters. Your brain has a scarcity bias: when something seems about to disappear, you value it more and skip the step where you ask "do I actually need this?"',
  'bandwagon': 'This post falsely claims everyone agrees, pressuring you to conform. Your brain has a powerful conformity instinct — disagreeing with a perceived majority literally activates pain centers. Manipulators exploit this by making fringe views look mainstream so you\'ll go along to belong.',
  'scapegoating': 'This post blames a complex situation on a specific person or group, giving you a simple villain instead of helping you understand the real causes. Your brain craves simple cause-and-effect stories. Blaming one target feels satisfying because it turns a confusing problem into a clear narrative with a clear enemy.',
  'fomo': 'This post manufactures exclusivity so you fear missing out. Your brain weighs potential losses roughly twice as heavily as equivalent gains — so "you\'ll miss this" hits harder than "you\'ll gain this." FOMO bypasses rational evaluation by making you focus on what you might lose.',
  'toxic-positivity': 'This post dismisses real feelings by forcing artificial optimism. Your brain needs to process negative emotions to learn from them. When someone says "just be positive," it shuts down that processing and makes you feel broken for having normal human reactions.',
  'misleading-format': 'This post uses ALL CAPS, excessive punctuation, or visual tricks to grab your attention and bypass your normal reading process. Your brain treats visual intensity as importance — ALL CAPS triggers the same alert system as a warning sign. This makes you absorb the message before your critical thinking kicks in.',
  'combined': 'This post layers multiple manipulation techniques at once. Each technique targets a different part of your brain\'s defense system. When they stack up, it\'s much harder to think clearly because you\'re processing fear, anger, or shame simultaneously.',
};

const TECHNIQUE_QUESTIONS: Record<TechniqueName, string> = {
  'fear-appeal': 'Try this: reread the claim but replace every scary word with a neutral one. Does the argument still hold up, or was fear doing all the work?',
  'shame-attack': 'Ask yourself: is this post criticizing what someone DID, or who they ARE? If it\'s attacking identity, the goal is contempt, not understanding.',
  'anger-trigger': 'Pause and notice: are you angry at an idea you disagree with, or at a person you\'ve been told to dislike? Those are very different things.',
  'false-urgency': 'Test it: if you waited 24 hours and this turned out to be nothing, what would you have lost? Real emergencies don\'t need ALL CAPS to convince you.',
  'bandwagon': 'Think about it: do you personally know anyone who holds this view, or is this post just telling you "everyone" does? Popularity can be manufactured.',
  'scapegoating': 'Challenge the story: can you name at least three other causes for this problem? If you can, then blaming one group is oversimplifying on purpose.',
  'fomo': 'Be honest: if you never saw this post, would your life actually be worse? FOMO works by making you imagine a loss that doesn\'t really exist.',
  'toxic-positivity': 'Check in with yourself: is this post making space for how you actually feel, or is it telling you that your real emotions are wrong?',
  'misleading-format': 'Try reading just the words, ignoring the CAPS and punctuation. Is the actual message as important as the formatting makes it seem?',
  'combined': 'Count them: how many different emotions is this post trying to trigger at once? The more buttons it pushes, the less it trusts its own argument.',
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

  // Prune disconnected elements (virtual scrolling cleanup)
  for (let i = guardOrder.length - 1; i >= 0; i--) {
    if (!guardOrder[i].isConnected) {
      const removed = guardOrder.splice(i, 1)[0];
      const obs = guards.get(removed);
      if (obs) {
        obs.disconnect();
        guards.delete(removed);
      }
    }
  }

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

/* Adult mode dot — top-left to avoid ALL Twitter interactive buttons */
span.fw-adult-dot {
  position: absolute !important;
  top: 8px !important;
  left: 8px !important;
  width: 5px !important;
  height: 5px !important;
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
  top: 14px !important;
  left: 0 !important;
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

  // Get ALL present techniques for display
  const presentTechniques = neutralized.analysis.techniques.filter(t => t.present);
  const pillTechnique = getPrimaryTechnique(neutralized);
  const pillTechniqueName = TECHNIQUE_NAMES[pillTechnique];

  // Create compact inline pill — just "✦ reframed", technique on hover
  const pill = document.createElement('span');
  pill.className = 'fw-teen-pill';
  if (visible) pill.classList.add('fw-animate-in');

  const label = document.createTextNode('\u2726 reframed');
  const techSpan = document.createElement('span');
  techSpan.className = 'fw-pill-technique';
  techSpan.textContent = ` \u00b7 ${pillTechniqueName}`;

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

    // Build technique blocks — show EACH detected technique individually
    let techniquesHtml = '';
    for (const t of presentTechniques) {
      const name = TECHNIQUE_NAMES[t.technique] ?? t.technique;
      const explanation = TECHNIQUE_EXPLANATIONS[t.technique] ?? '';
      const question = TECHNIQUE_QUESTIONS[t.technique] ?? '';
      techniquesHtml += `
        <div class="fw-panel-label">${escapeHtml(name)} (severity ${t.severity}/10)</div>
        <div class="fw-panel-explanation">${escapeHtml(explanation)}</div>
        <div class="fw-panel-question">\u2192 ${escapeHtml(question)}</div>
      `;
    }

    panel.innerHTML = `
      <div class="fw-panel-header">\u2726 FeelingWise spotted something</div>
      <div class="fw-panel-label">Original</div>
      <div class="fw-panel-original">${escapeHtml(originalText)}</div>
      ${techniquesHtml}
      <button class="fw-teen-gotit">Got it</button>
    `;

    panel.querySelector('.fw-teen-gotit')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      panel.remove();
      // Send confirmed verdict — teen clicked "Got it" = they understood the manipulation
      chrome.runtime.sendMessage({
        type: 'USER_VERDICT',
        payload: { postId: neutralized.postId, verdict: 'confirmed', mode: 'teen' },
      }).catch(() => {});
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

  // Create amber dot — positioned top-left to avoid all Twitter interactive buttons
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

    // "See neutralized" button — adult confirms manipulation by choosing to see clean version
    panel.querySelector('.fw-see-neutral')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      replaceText(el, neutralized.rewrittenText);
      el.setAttribute('data-fw-neutralized', 'true');
      dot.classList.add('fw-seen');
      addGuard(el, neutralized.rewrittenText);
      panel.remove();
      chrome.runtime.sendMessage({
        type: 'USER_VERDICT',
        payload: { postId: neutralized.postId, verdict: 'confirmed', mode: 'adult' },
      }).catch(() => {});
    });

    // "Dismiss" button — adult disputes the detection
    panel.querySelector('.fw-dismiss')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      panel.remove();
      chrome.runtime.sendMessage({
        type: 'USER_VERDICT',
        payload: { postId: neutralized.postId, verdict: 'disputed', mode: 'adult' },
      }).catch(() => {});
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
