// FeelingWise - DOM injection (complete rewrite)
// Three fundamentally different mode behaviors:
//   child  — invisible replacement (zero UI)
//   teen   — protected + learning (pill + expandable panel)
//   adult  — transparency first (original stays, amber dot indicator)

import { NeutralizedContent } from '../types/neutralization';
import { TechniqueName } from '../types/analysis';
import { Mode } from '../types/mode';
import { PlatformAction } from '../types/platform-action';

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
  'profanity': 'Explicit Content',
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
  'profanity': 'This post contains explicit language that isn\'t appropriate. Vulgar content can normalize aggression and hostility, making it harder to have productive conversations.',
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
  'profanity': 'Notice the language: is this person making a point, or just being vulgar? Strong arguments don\'t need explicit words to be convincing.',
};

const TECHNIQUE_TLDR: Record<TechniqueName, string> = {
  'fear-appeal': 'Amps up fear to stop you from thinking clearly.',
  'shame-attack': 'Attacks who you are instead of making an argument.',
  'anger-trigger': 'Designed to make you angry before you can think.',
  'false-urgency': 'Fake deadline to make you act without thinking.',
  'bandwagon': 'Pretends everyone agrees so you feel weird for disagreeing.',
  'scapegoating': 'Blames one group for a complicated problem.',
  'fomo': 'Makes you panic about missing something that doesn\'t matter.',
  'toxic-positivity': 'Tells you your real feelings are wrong.',
  'misleading-format': 'Uses ALL CAPS and visual tricks to bypass your brain.',
  'combined': 'Stacks multiple tricks at once to overwhelm your defenses.',
  'profanity': 'Uses explicit language instead of making a real argument.',
};

const TECHNIQUE_COLORS: Record<TechniqueName, string> = {
  'fear-appeal': '#ef5350',
  'anger-trigger': '#ff7043',
  'shame-attack': '#ab47bc',
  'false-urgency': '#ffab40',
  'bandwagon': '#42a5f5',
  'scapegoating': '#ec407a',
  'fomo': '#ffa726',
  'toxic-positivity': '#66bb6a',
  'misleading-format': '#78909c',
  'combined': '#5c6bc0',
  'profanity': '#e53935',
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
div.fw-teen-panel .fw-panel-detail {
  color: rgb(139, 152, 165) !important;
  font-size: 13px !important;
  margin-top: 4px !important;
  line-height: 1.5 !important;
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

/* Teen mode actions — flex row for Got it + Not manipulation */
.fw-teen-actions {
  display: flex !important;
  justify-content: center !important;
  gap: 8px !important;
  margin-top: 10px !important;
}
button.fw-teen-dispute {
  display: block !important;
  padding: 6px 18px !important;
  background: transparent !important;
  border: 1px solid rgba(255, 171, 64, 0.3) !important;
  border-radius: 9999px !important;
  color: rgb(231, 233, 234) !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  transition: background 0.15s ease !important;
}
button.fw-teen-dispute:hover {
  background: rgba(255, 171, 64, 0.1) !important;
}

/* Teen mode challenge panel */
div.fw-teen-challenge {
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
.fw-teen-challenge-prompt {
  font-size: 15px !important;
  font-weight: 700 !important;
  color: rgb(231, 233, 234) !important;
  margin-bottom: 10px !important;
}
.fw-teen-challenge-options {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
  margin-bottom: 8px !important;
}
button.fw-teen-challenge-btn {
  padding: 6px 14px !important;
  background: transparent !important;
  border: 1px solid rgba(113, 118, 123, 0.3) !important;
  border-radius: 9999px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  transition: background 0.15s ease, border-color 0.15s ease !important;
}
button.fw-teen-challenge-btn:hover {
  background: rgba(231, 233, 234, 0.05) !important;
}
.fw-teen-challenge-skip {
  display: block !important;
  text-align: center !important;
  color: rgb(113, 118, 123) !important;
  font-size: 13px !important;
  cursor: pointer !important;
  text-decoration: none !important;
  margin-top: 4px !important;
}
.fw-teen-challenge-skip:hover {
  text-decoration: underline !important;
}
.fw-teen-challenge-result {
  font-size: 14px !important;
  font-weight: 700 !important;
  margin-top: 8px !important;
  text-align: center !important;
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

/* Video platform: dimmed/flagged video container */
[data-fw-flagged-video] {
  transition: opacity 0.3s ease, filter 0.3s ease !important;
}

/* Flagged comment highlight */
[data-fw-flagged-comment] {
  transition: border-color 0.2s ease !important;
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

  // Helper: build the full analysis panel element
  function buildAnalysisPanel(): HTMLDivElement {
    const originalText = el.getAttribute('data-fw-original')?.replace(/<[^>]*>/g, '') ?? '';

    const panel = document.createElement('div');
    panel.className = 'fw-teen-panel';
    if (visible) panel.classList.add('fw-animate-in');

    // Build technique blocks — show EACH detected technique individually
    let techniquesHtml = '';
    for (const t of presentTechniques) {
      const name = TECHNIQUE_NAMES[t.technique] ?? t.technique;
      const tldr = TECHNIQUE_TLDR[t.technique] ?? '';
      const explanation = TECHNIQUE_EXPLANATIONS[t.technique] ?? '';
      const question = TECHNIQUE_QUESTIONS[t.technique] ?? '';
      techniquesHtml += `
        <div class="fw-panel-label">${escapeHtml(name)} (severity ${t.severity}/10)</div>
        <div class="fw-panel-explanation">${escapeHtml(tldr)}</div>
        <div class="fw-panel-expand" style="cursor:pointer;color:rgb(29,155,240);font-size:12px;margin-top:4px">Learn more \u25b8</div>
        <div class="fw-panel-detail" style="display:none">${escapeHtml(explanation)}</div>
        <div class="fw-panel-question">\u2192 ${escapeHtml(question)}</div>
      `;
    }

    panel.innerHTML = `
      <div class="fw-panel-header">\u2726 FeelingWise spotted something</div>
      <div class="fw-panel-label">Original</div>
      <div class="fw-panel-original">${escapeHtml(originalText)}</div>
      ${techniquesHtml}
      <div class="fw-teen-actions">
        <button class="fw-teen-gotit">Got it</button>
        <button class="fw-teen-dispute">Not manipulation</button>
      </div>
    `;

    panel.querySelectorAll('.fw-panel-expand').forEach(expandEl => {
      expandEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const detail = expandEl.nextElementSibling as HTMLElement | null;
        if (!detail) return;
        const isHidden = detail.style.display === 'none';
        detail.style.display = isHidden ? 'block' : 'none';
        expandEl.textContent = isHidden ? 'Learn more \u25be' : 'Learn more \u25b8';
      });
    });

    panel.querySelector('.fw-teen-gotit')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      panel.remove();
      chrome.runtime.sendMessage({
        type: 'USER_VERDICT',
        payload: { postId: neutralized.postId, verdict: 'confirmed', mode: 'teen' },
      }).catch(() => {});
    });

    panel.querySelector('.fw-teen-dispute')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'USER_VERDICT',
        payload: { postId: neutralized.postId, verdict: 'disputed', mode: 'teen' },
      }).catch(() => {});
      // Restore original text and disconnect guard
      const origHtml = el.getAttribute('data-fw-original') ?? '';
      const origText = origHtml.replace(/<[^>]*>/g, '');
      replaceText(el, origText);
      const guard = guards.get(el);
      if (guard) {
        guard.disconnect();
        guards.delete(el);
      }
      panel.remove();
    });

    return panel;
  }

  // Helper: show the analysis panel, replacing a given element if provided
  function showAnalysisPanel(replaceEl?: HTMLElement): void {
    const panel = buildAnalysisPanel();
    if (replaceEl && replaceEl.parentElement) {
      replaceEl.parentElement.insertBefore(panel, replaceEl);
      replaceEl.remove();
    } else {
      pill.insertAdjacentElement('afterend', panel);
    }
  }

  pill.addEventListener('click', (e) => {
    e.stopPropagation();

    // Toggle — remove existing panel or challenge
    const existingPanel = el.parentElement?.querySelector('.fw-teen-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }
    const existingChallenge = el.parentElement?.querySelector('.fw-teen-challenge');
    if (existingChallenge) {
      existingChallenge.remove();
      return;
    }

    // Build challenge panel
    const challenge = document.createElement('div');
    challenge.className = 'fw-teen-challenge';
    if (visible) challenge.classList.add('fw-animate-in');

    // Pick 3 wrong options: exclude correct answer AND any present techniques
    const presentKeys = new Set(presentTechniques.map(t => t.technique));
    const allKeys = Object.keys(TECHNIQUE_NAMES) as TechniqueName[];
    const wrongPool = allKeys.filter(k => k !== pillTechnique && !presentKeys.has(k));
    // Fisher-Yates shuffle
    for (let i = wrongPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrongPool[i], wrongPool[j]] = [wrongPool[j], wrongPool[i]];
    }
    const wrongOptions = wrongPool.slice(0, 3);

    // Combine and shuffle all 4 options
    const options: TechniqueName[] = [pillTechnique, ...wrongOptions];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    // Build challenge HTML
    const promptDiv = document.createElement('div');
    promptDiv.className = 'fw-teen-challenge-prompt';
    promptDiv.textContent = 'What technique do you think was used?';
    challenge.appendChild(promptDiv);

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'fw-teen-challenge-options';

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'fw-teen-challenge-btn';
      btn.textContent = TECHNIQUE_NAMES[opt];
      const color = TECHNIQUE_COLORS[opt];
      btn.style.cssText = `color: ${color} !important; border-color: ${color}4d !important;`;

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // Disable all buttons after click
        optionsDiv.querySelectorAll('button').forEach(b => {
          (b as HTMLButtonElement).disabled = true;
          b.style.pointerEvents = 'none';
          b.style.opacity = '0.5';
        });

        if (opt === pillTechnique) {
          // Correct!
          btn.style.opacity = '1';
          const result = document.createElement('div');
          result.className = 'fw-teen-challenge-result';
          result.textContent = '\u2713 Nice catch!';
          result.style.color = '#66bb6a';
          challenge.appendChild(result);
          chrome.runtime.sendMessage({
            type: 'USER_VERDICT',
            payload: { postId: neutralized.postId, verdict: 'spotted', mode: 'teen' },
          }).catch(() => {});
          setTimeout(() => showAnalysisPanel(challenge), 800);
        } else {
          // Wrong
          const result = document.createElement('div');
          result.className = 'fw-teen-challenge-result';
          result.textContent = 'Not quite \u2014 here\u2019s what was detected:';
          challenge.appendChild(result);
          setTimeout(() => showAnalysisPanel(challenge), 600);
        }
      });

      optionsDiv.appendChild(btn);
    }
    challenge.appendChild(optionsDiv);

    // Skip link
    const skip = document.createElement('a');
    skip.className = 'fw-teen-challenge-skip';
    skip.textContent = 'Skip \u2014 show me';
    skip.addEventListener('click', (ev) => {
      ev.stopPropagation();
      showAnalysisPanel(challenge);
    });
    challenge.appendChild(skip);

    pill.insertAdjacentElement('afterend', challenge);
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

// ─── VIDEO PLATFORM ACTIONS ───
// Handle video-platform-specific actions (suppress comments, flag video).
// Called instead of injectIntoElement when platform is video-first.

export function injectVideoPlatformAction(
  action: PlatformAction,
  el: HTMLElement,
  neutralized: NeutralizedContent | null,
  mode: Mode,
  platform: string,
): void {
  try {
    injectStyles();

    switch (action) {
      case 'suppress-comments':
        suppressComments(el, platform);
        break;
      case 'flag-video':
        if (neutralized) flagVideoContainer(el, neutralized, mode);
        break;
      case 'flag-comments':
        if (neutralized) flagComment(el, neutralized, mode);
        break;
    }
  } catch {
    // Consistency rule 13: failure = original stays
  }
}

function suppressComments(el: HTMLElement, platform: string): void {
  // Find the comments section container and collapse it
  let commentsContainer: HTMLElement | null = null;

  if (platform === 'youtube') {
    commentsContainer = document.querySelector<HTMLElement>('ytd-comments#comments');
  } else if (platform === 'tiktok') {
    commentsContainer = el.closest('[data-e2e="comment-list"]') as HTMLElement;
  } else if (platform === 'instagram') {
    // Instagram comments are in UL elements under articles
    commentsContainer = el.closest('ul') as HTMLElement;
  }

  if (!commentsContainer) return;
  if (commentsContainer.dataset.fwSuppressed) return;

  commentsContainer.dataset.fwSuppressed = 'true';
  commentsContainer.style.display = 'none';
  // Leave no trace in child mode — the comments section simply doesn't appear
}

function flagVideoContainer(el: HTMLElement, neutralized: NeutralizedContent, mode: Mode): void {
  // Find the video's parent container
  const container = el.closest('article') ??
    el.closest('[data-e2e="recommend-list-item-container"]') ??
    el.closest('ytd-rich-item-renderer') ??
    el.closest('ytd-video-renderer') ??
    el.parentElement;

  if (!container || (container as HTMLElement).dataset.fwFlaggedVideo) return;
  (container as HTMLElement).dataset.fwFlaggedVideo = 'true';

  if (mode === 'child') {
    // Child mode: dim the video, no explanation
    (container as HTMLElement).style.opacity = '0.3';
    (container as HTMLElement).style.filter = 'grayscale(0.8)';
    (container as HTMLElement).style.pointerEvents = 'none';
    return;
  }

  // Teen/adult: add a badge overlay (similar to adult dot but on video container)
  const dot = document.createElement('span');
  dot.className = 'fw-adult-dot';
  dot.classList.add('fw-animate-in');
  dot.style.top = '12px';
  dot.style.left = '12px';
  dot.style.width = '8px';
  dot.style.height = '8px';

  if (getComputedStyle(container as HTMLElement).position === 'static') {
    (container as HTMLElement).style.position = 'relative';
  }

  // Click to toggle analysis panel
  dot.addEventListener('click', (e) => {
    e.stopPropagation();

    const existingPanel = (container as HTMLElement).querySelector('.fw-adult-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    const techniques = neutralized.analysis.techniques.filter(t => t.present);
    const panel = document.createElement('div');
    panel.className = mode === 'teen' ? 'fw-teen-panel fw-animate-in' : 'fw-adult-panel fw-animate-in';

    const techList = techniques.map(t =>
      `${escapeHtml(t.technique.replace(/-/g, ' '))} (severity ${t.severity}/10)`
    ).join(', ');

    panel.innerHTML = `
      <div class="fw-panel-header">${mode === 'teen' ? '\u2726' : '\u26a0'} Manipulation signals detected</div>
      <div class="fw-panel-label">Source</div>
      <div class="fw-panel-detail">Detected in title, description, or comments \u2014 video content not analyzed</div>
      <div class="fw-panel-label">Signals</div>
      <div class="fw-panel-detail">${techList || 'Multiple signals detected'}</div>
      <div class="fw-panel-label">Confidence</div>
      <div class="fw-panel-detail">${Math.round(neutralized.analysis.overallConfidence * 100)}% (based on text environment only)</div>
    `;

    el.insertAdjacentElement('afterend', panel);
  });

  (container as HTMLElement).appendChild(dot);
}

function flagComment(el: HTMLElement, neutralized: NeutralizedContent, _mode: Mode): void {
  // For teen mode on video platforms: show the comment with an inline analysis indicator
  if (el.dataset.fwFlaggedComment) return;
  el.dataset.fwFlaggedComment = 'true';

  // Add a subtle left border to flagged comments
  el.style.borderLeft = '2px solid rgba(255, 171, 64, 0.4)';
  el.style.paddingLeft = '8px';

  // Add the teen pill after the comment
  const pill = document.createElement('span');
  pill.className = 'fw-teen-pill';
  pill.textContent = '\u2726 flagged';
  pill.style.display = 'block';
  pill.style.marginTop = '4px';
  el.appendChild(pill);
}
