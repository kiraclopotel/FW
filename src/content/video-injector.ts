import { InterventionTier, InterventionDecision } from '../modes/intervention-tiers';
import { Mode } from '../types/mode';
import { NeutralizedContent } from '../types/neutralization';

/**
 * Apply video-platform interventions to the DOM.
 * Called by the main content script when platform is video-first.
 */
export function applyVideoInterventions(
  decision: InterventionDecision,
  videoContainer: HTMLElement,
  commentsContainer: HTMLElement | null,
  metricsElements: HTMLElement[],
  mode: Mode,
  analysisData: NeutralizedContent | null,
): void {
  if (decision.actions.includes('none') || decision.actions.length === 0) return;

  for (const action of decision.actions) {
    switch (action) {
      case 'hide-metrics':
        hideEngagementMetrics(metricsElements);
        break;
      case 'collapse-comments':
        collapseComments(commentsContainer, mode, decision);
        break;
      case 'flag-container':
        flagVideoContainer(videoContainer, mode, decision, analysisData);
        break;
      case 'dim-content':
        dimVideoContent(videoContainer);
        break;
    }
  }
}

/**
 * Tier 1: Hide engagement metrics (like counts, view counts, share counts).
 * Evidence: Sherman et al. 2016 (fMRI) — engagement numbers activate
 * adolescent reward circuitry and reduce cognitive control.
 *
 * Implementation: set display:none on metric elements.
 * These are the NUMBERS, not the buttons — users can still like/share.
 */
function hideEngagementMetrics(elements: HTMLElement[]): void {
  for (const el of elements) {
    if (el.dataset.fwMetricsHidden) continue;
    el.dataset.fwMetricsHidden = 'true';
    el.style.visibility = 'hidden';
    el.style.height = '0';
    el.style.overflow = 'hidden';
    el.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Tier 2: Collapse comments section.
 * Evidence: Walther 2010 — comments override video persuasion effects.
 * Boot 2021 — negative comments reduce credibility via negativity bias.
 *
 * Implementation: collapse to a summary bar showing comment distribution.
 * NOT hidden — user can expand with a deliberate click (adds friction).
 */
function collapseComments(
  container: HTMLElement | null,
  mode: Mode,
  decision: InterventionDecision,
): void {
  if (!container || container.dataset.fwCommentsCollapsed) return;
  container.dataset.fwCommentsCollapsed = 'true';

  // Store original display for restore
  container.dataset.fwOriginalDisplay = container.style.display || '';

  // Hide the comments
  container.style.display = 'none';

  // Create the collapse bar
  const bar = document.createElement('div');
  bar.className = 'fw-comments-collapsed-bar';
  bar.style.cssText = `
    padding: 10px 16px;
    margin: 8px 0;
    border-radius: 8px;
    background: rgba(128, 128, 128, 0.08);
    border: 1px solid rgba(128, 128, 128, 0.15);
    cursor: pointer;
    font-size: 13px;
    color: rgba(128, 128, 128, 0.7);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.2s ease;
  `;

  if (mode === 'child') {
    // Child mode: minimal, no detail
    bar.textContent = 'Comments hidden for your safety';
  } else if (mode === 'teen') {
    // Teen mode: educational — explain WHY
    const flaggedCount = decision.signalSources.includes('comments')
      ? decision.signalSources.length
      : 0;
    bar.innerHTML = `
      <span style="font-size: 16px">\u2726</span>
      <span>Comments collapsed — ${flaggedCount > 0 ? `${flaggedCount} manipulation signal${flaggedCount === 1 ? '' : 's'} detected` : 'comment section may amplify manipulation'}.
      <strong style="text-decoration: underline">Click to expand and learn why</strong></span>
    `;
  }

  // Click to expand
  bar.addEventListener('click', () => {
    container.style.display = container.dataset.fwOriginalDisplay || '';
    bar.remove();
  });

  bar.addEventListener('mouseenter', () => {
    bar.style.background = 'rgba(128, 128, 128, 0.12)';
  });
  bar.addEventListener('mouseleave', () => {
    bar.style.background = 'rgba(128, 128, 128, 0.08)';
  });

  container.insertAdjacentElement('beforebegin', bar);
}

/**
 * Tier 3: Flag video container with badge + analysis panel.
 * Only applied when multi-source convergence is achieved.
 * Educational for teens, informational for adults.
 */
function flagVideoContainer(
  container: HTMLElement,
  mode: Mode,
  decision: InterventionDecision,
  analysisData: NeutralizedContent | null,
): void {
  if (container.dataset.fwFlaggedVideo) return;
  container.dataset.fwFlaggedVideo = 'true';

  // Ensure positioned for absolute children
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // Amber badge (same visual language as text-platform adult dot)
  const badge = document.createElement('div');
  badge.className = 'fw-video-badge';
  badge.style.cssText = `
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(255, 171, 64, 0.9);
    color: #1a1a1a;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: transform 0.15s ease;
  `;

  const sourceLabels: Record<string, string> = {
    'title': 'title',
    'description': 'description',
    'comments': 'comments',
    'subtitles': 'subtitles',
    'author-history': 'author pattern',
  };

  const sourceText = decision.signalSources
    .map(s => sourceLabels[s] || s)
    .join(' + ');

  badge.textContent = `\u26a0 ${(decision.confidence * 100).toFixed(0)}% — ${sourceText}`;

  badge.addEventListener('mouseenter', () => { badge.style.transform = 'scale(1.05)'; });
  badge.addEventListener('mouseleave', () => { badge.style.transform = 'scale(1)'; });

  // Click to show analysis panel
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    const existing = container.querySelector('.fw-video-analysis-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.className = 'fw-video-analysis-panel';
    panel.style.cssText = `
      position: absolute;
      top: 40px;
      left: 8px;
      z-index: 11;
      padding: 16px;
      border-radius: 8px;
      max-width: 320px;
      font-size: 12px;
      line-height: 1.5;
      background: rgba(30, 30, 30, 0.95);
      color: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(255, 171, 64, 0.3);
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `;

    let content = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #ffab40;">
        Manipulation signals detected
      </div>
      <div style="margin-bottom: 6px;">
        <strong>Sources analyzed:</strong> ${sourceText}
      </div>
      <div style="margin-bottom: 6px;">
        <strong>Confidence:</strong> ${(decision.confidence * 100).toFixed(0)}%
        (based on text environment — video content not analyzed)
      </div>
      <div style="margin-bottom: 6px;">
        <strong>Why this was flagged:</strong> ${decision.reason}
      </div>
    `;

    if (mode === 'teen') {
      content += `
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
          <strong>\u2726 Think about it:</strong> Does the title try to make you feel
          something before you even watch? Do the comments all say the same thing?
          These are signs the environment around this video may be amplifying a message.
        </div>
      `;
    }

    panel.innerHTML = content;

    // Close on outside click
    const closeHandler = (ev: MouseEvent) => {
      if (!panel.contains(ev.target as Node) && ev.target !== badge) {
        panel.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);

    container.appendChild(panel);
  });

  container.appendChild(badge);
}

/**
 * Tier 4: Dim video content (child mode only, high confidence).
 * Maximum intervention — NEVER fully hide.
 * Evidence: Bushman & Cantor meta-analysis shows full blocking
 * triggers circumvention. Dimming signals "caution" without
 * creating forbidden-fruit effect.
 */
function dimVideoContent(container: HTMLElement): void {
  if (container.dataset.fwDimmed) return;
  container.dataset.fwDimmed = 'true';
  container.style.opacity = '0.3';
  container.style.filter = 'grayscale(0.6)';
  container.style.transition = 'opacity 0.3s ease, filter 0.3s ease';
  container.style.pointerEvents = 'auto';  // Still clickable — not blocked
}
