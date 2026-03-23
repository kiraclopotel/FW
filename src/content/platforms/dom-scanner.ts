/**
 * FeelingWise — DOM Diagnostic Scanner
 *
 * PURPOSE: Discover platform UI elements by what they ARE, not what they're named.
 * LEGAL BASIS: Reading rendered DOM is equivalent to assistive technology / screen reader.
 * We only observe what the browser already shows the user. No API calls, no server contact.
 *
 * WHEN TO USE:
 *   - Automatically on extension load (reports to console)
 *   - Manually via __FW_SCAN() in DevTools console
 *   - When known selectors fail (fallback discovery)
 *
 * HOW IT WORKS:
 *   Metrics: Find elements containing numeric text (47.2K, 630, 5.6M) near SVG icons
 *   Comments: Find containers with 3+ children that each have author link + text
 *   Inputs: Find contenteditable/textarea elements with comment-related placeholder text
 */

// ─── Types ───

export interface ScanResult {
  platform: string;
  timestamp: string;
  metrics: MetricScanResult[];
  commentsContainer: ContainerScanResult | null;
  commentInput: InputScanResult[];
  knownSelectorStatus: Record<string, 'found' | 'not-found' | 'error'>;
}

interface MetricScanResult {
  text: string;           // "47.2K"
  tagName: string;        // "STRONG"
  parentTag: string;      // "BUTTON"
  hasNearbySVG: boolean;
  selector: string;       // Best CSS path for this element
  dataAttributes: Record<string, string>;  // All data-* attributes on element and parent
}

interface ContainerScanResult {
  tagName: string;
  childCount: number;
  selector: string;
  dataAttributes: Record<string, string>;
  sampleChildStructure: string;  // Description of what children contain
}

interface InputScanResult {
  tagName: string;
  type: string;
  placeholder: string;
  ariaLabel: string;
  selector: string;
}

// ─── Known selector registry ───
// These are the selectors we CURRENTLY use. The diagnostic checks if they still work.

const KNOWN_SELECTORS: Record<string, Record<string, string[]>> = {
  tiktok: {
    metrics: [
      '[data-e2e="like-count"]',
      '[data-e2e="comment-count"]',
      '[data-e2e="share-count"]',
      '[data-e2e="undefined-count"]',
    ],
    comments: [
      '[data-e2e="comment-list"]',
      'div[class*="Comment"] > ul',
      'div[class*="comment"] > ul',
    ],
    input: [
      '[data-e2e="comment-input"]',
      '[placeholder*="comentariu" i]',
      '[placeholder*="comment" i]',
      '[data-e2e="comment-bottom"] [contenteditable]',
      'div[class*="InputContainer"] [contenteditable]',
    ],
  },
  youtube: {
    metrics: [
      'ytd-menu-renderer yt-formatted-string[aria-label*="like" i]',
      'ytd-video-primary-info-renderer ytd-video-view-count-renderer',
      'ytd-comments-header-renderer h2 yt-formatted-string',
      '#owner-sub-count',
    ],
    comments: ['ytd-comments#comments'],
    input: ['ytd-comment-simplebox-renderer', '#placeholder-area'],
  },
  instagram: {
    metrics: [
      'section span a[role="link"]',
      '[aria-label*="like" i]',
    ],
    comments: ['article ul[class]'],
    input: [
      'textarea[aria-label*="comment" i]',
      'textarea[placeholder*="comment" i]',
      'textarea[placeholder*="comentariu" i]',
    ],
  },
};

// ─── Selector status check ───

function checkKnownSelectors(platform: string): Record<string, 'found' | 'not-found' | 'error'> {
  const results: Record<string, 'found' | 'not-found' | 'error'> = {};
  const platformSelectors = KNOWN_SELECTORS[platform];
  if (!platformSelectors) return results;

  for (const [category, selectors] of Object.entries(platformSelectors)) {
    for (const sel of selectors) {
      const key = `${category}:${sel}`;
      try {
        const el = document.querySelector(sel);
        results[key] = el ? 'found' : 'not-found';
      } catch {
        results[key] = 'error';
      }
    }
  }
  return results;
}

// ─── Metric discovery (structural) ───

const METRIC_PATTERN = /^\s*\d[\d,.]*\s*[KkMmBb]?\s*$/;

function discoverMetricElements(): MetricScanResult[] {
  const results: MetricScanResult[] = [];
  const seen = new WeakSet<HTMLElement>();

  // Walk all elements looking for numeric text near icons
  const candidates = document.querySelectorAll<HTMLElement>(
    'strong, span, div, p, a'
  );

  for (const el of candidates) {
    // Skip if already found or inside script/style
    if (seen.has(el)) continue;
    if (el.closest('script, style, nav, header')) continue;

    // Check if this element's DIRECT text content matches a metric pattern
    // (not children's text — we want the leaf node that holds "47.2K")
    const directText = getDirectTextContent(el);
    if (!directText || !METRIC_PATTERN.test(directText)) continue;
    if (directText.length > 15) continue; // Too long to be a metric

    // Check for nearby SVG icon (within 3 ancestor levels)
    const hasNearbySVG = hasIconNearby(el, 4);

    // Skip if inside video player controls (progress bar, time display)
    if (isInsideVideoPlayer(el)) continue;

    // Skip nav bar elements (TikTok notification counts, etc.)
    if (isInsideNavigation(el)) continue;

    seen.add(el);

    // Collect data attributes from element and parents (up to 3 levels)
    const dataAttrs = collectDataAttributes(el, 3);

    results.push({
      text: directText.trim(),
      tagName: el.tagName,
      parentTag: el.parentElement?.tagName ?? 'none',
      hasNearbySVG,
      selector: buildSelector(el),
      dataAttributes: dataAttrs,
    });
  }

  return results;
}

function getDirectTextContent(el: HTMLElement): string {
  // Get text that belongs directly to this element, not its children
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    }
  }
  // If no direct text nodes, fall back to textContent only if element has 0-1 children
  if (!text.trim() && el.children.length <= 1) {
    text = el.textContent ?? '';
  }
  return text.trim();
}

function hasIconNearby(el: HTMLElement, maxLevels: number): boolean {
  let current: HTMLElement | null = el;
  for (let i = 0; i < maxLevels && current; i++) {
    current = current.parentElement;
    if (!current) break;
    // Check for SVG, img with icon-like src, or elements with icon-related class/role
    if (current.querySelector(':scope > svg, :scope > img[src*="icon"], :scope svg')) {
      return true;
    }
    // Also check siblings of the current ancestor
    for (const sibling of Array.from(current.children)) {
      if (sibling === el || sibling.contains(el)) continue;
      if (sibling.tagName === 'SVG' || sibling.querySelector('svg')) {
        return true;
      }
    }
  }
  return false;
}

function isInsideVideoPlayer(el: HTMLElement): boolean {
  let current: HTMLElement | null = el;
  while (current) {
    const tag = current.tagName?.toLowerCase();
    if (tag === 'video') return true;
    // YouTube player
    if (tag === 'ytd-player' || current.id === 'movie_player') return true;
    // Common player roles
    const role = current.getAttribute('role');
    if (role === 'slider' || role === 'progressbar') return true;
    // TikTok player area
    if (current.getAttribute('data-e2e')?.includes('video-player')) return true;
    // Generic player classes
    const cls = current.className ?? '';
    if (typeof cls === 'string' && /\b(player|video-container|media-player)\b/i.test(cls)) return true;
    current = current.parentElement;
  }
  return false;
}

function isInsideNavigation(el: HTMLElement): boolean {
  let current: HTMLElement | null = el;
  while (current) {
    const tag = current.tagName?.toLowerCase();
    if (tag === 'nav') return true;
    // TikTok nav indicators
    const dataE2e = current.getAttribute('data-e2e');
    if (dataE2e === 'inbox-icon' || dataE2e === 'nav-activity' ||
         dataE2e === 'nav-home' || dataE2e === 'nav-discover') return true;
    // Generic navigation roles
    const role = current.getAttribute('role');
    if (role === 'navigation' || role === 'banner') return true;
    // Aria labels suggesting navigation
    const ariaLabel = current.getAttribute('aria-label')?.toLowerCase() ?? '';
    if (ariaLabel.includes('navigation') || ariaLabel.includes('notific')) return true;

    current = current.parentElement;
  }
  return false;
}

function collectDataAttributes(el: HTMLElement, levels: number): Record<string, string> {
  const attrs: Record<string, string> = {};
  let current: HTMLElement | null = el;
  for (let i = 0; i <= levels && current; i++) {
    const prefix = i === 0 ? 'self' : `parent${i}`;
    for (const attr of Array.from(current.attributes)) {
      if (attr.name.startsWith('data-')) {
        attrs[`${prefix}.${attr.name}`] = attr.value.slice(0, 50);
      }
    }
    // Also capture aria-label (often useful for identification)
    const ariaLabel = current.getAttribute('aria-label');
    if (ariaLabel) {
      attrs[`${prefix}.aria-label`] = ariaLabel.slice(0, 80);
    }
    current = current.parentElement;
  }
  return attrs;
}

function buildSelector(el: HTMLElement): string {
  // Build the most useful CSS selector for this specific element
  // Priority: data-e2e > id > aria-label > tag.class path

  // Check for data-e2e on element or parent
  const e2e = el.getAttribute('data-e2e') ?? el.parentElement?.getAttribute('data-e2e');
  if (e2e) return `[data-e2e="${e2e}"]`;

  // Check for ID
  if (el.id) return `#${el.id}`;

  // Check for aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return `[aria-label="${ariaLabel.slice(0, 40)}"]`;

  // Fall back to tag + position
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const parentTag = parent.tagName.toLowerCase();
    const parentE2e = parent.getAttribute('data-e2e');
    if (parentE2e) return `[data-e2e="${parentE2e}"] > ${tag}`;
    return `${parentTag} > ${tag}`;
  }
  return tag;
}

// ─── Comments container discovery ───

function discoverCommentsContainer(platform: string): ContainerScanResult | null {
  // Try known selectors first
  const known = KNOWN_SELECTORS[platform]?.comments ?? [];
  for (const sel of known) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && el.children.length >= 2) {
        return describeContainer(el);
      }
    } catch { /* invalid selector */ }
  }

  // Structural discovery: find container with 3+ children each having author + text
  const allContainers = document.querySelectorAll<HTMLElement>('div, ul, section');
  for (const container of allContainers) {
    if (container.children.length < 3) continue;
    if (isInsideVideoPlayer(container)) continue;
    // Skip if too high in the DOM tree (body, main wrapper)
    if (container === document.body) continue;
    if (container.children.length > 200) continue; // Probably not a comment list

    let commentLikeChildren = 0;
    for (const child of Array.from(container.children).slice(0, 8)) {
      if (!(child instanceof HTMLElement)) continue;
      const hasAuthorLink = !!child.querySelector('a[href*="/@"], a[href*="/user/"], a[href*="/channel/"], a[href^="/"][role="link"]');
      const textLength = child.textContent?.length ?? 0;
      if (hasAuthorLink && textLength > 15) commentLikeChildren++;
    }

    if (commentLikeChildren >= 3) {
      return describeContainer(container);
    }
  }

  return null;
}

function describeContainer(el: HTMLElement): ContainerScanResult {
  const firstChild = el.children[0] as HTMLElement | undefined;
  let sampleStructure = 'unknown';
  if (firstChild) {
    const tags = Array.from(firstChild.children).slice(0, 5).map(c => c.tagName.toLowerCase());
    sampleStructure = `<${firstChild.tagName.toLowerCase()}> with children: ${tags.join(', ')}`;
  }

  return {
    tagName: el.tagName,
    childCount: el.children.length,
    selector: buildSelector(el),
    dataAttributes: collectDataAttributes(el, 2),
    sampleChildStructure: sampleStructure,
  };
}

// ─── Comment input discovery ───

function discoverCommentInputs(platform: string): InputScanResult[] {
  const results: InputScanResult[] = [];

  // Known selectors
  const known = KNOWN_SELECTORS[platform]?.input ?? [];
  for (const sel of known) {
    try {
      const els = document.querySelectorAll<HTMLElement>(sel);
      for (const el of els) {
        results.push({
          tagName: el.tagName,
          type: el.getAttribute('type') ?? (el as HTMLElement).contentEditable ?? '',
          placeholder: el.getAttribute('placeholder') ?? el.getAttribute('data-placeholder') ?? '',
          ariaLabel: el.getAttribute('aria-label') ?? '',
          selector: sel,
        });
      }
    } catch { /* skip */ }
  }

  // Structural fallback: any editable element with comment-related text
  if (results.length === 0) {
    const editables = document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"], textarea, input[type="text"]'
    );
    for (const el of editables) {
      const placeholder = el.getAttribute('placeholder') ??
        el.getAttribute('aria-label') ??
        el.getAttribute('data-placeholder') ?? '';
      if (/comment|comentariu|reply|respond|răspunde|adaugă/i.test(placeholder)) {
        results.push({
          tagName: el.tagName,
          type: el.getAttribute('type') ?? el.contentEditable ?? '',
          placeholder: placeholder.slice(0, 60),
          ariaLabel: el.getAttribute('aria-label')?.slice(0, 60) ?? '',
          selector: buildSelector(el),
        });
      }
    }
  }

  return results;
}

// ─── Main scan function ───

export function scanDOM(platform: string): ScanResult {
  const result: ScanResult = {
    platform,
    timestamp: new Date().toISOString(),
    metrics: discoverMetricElements(),
    commentsContainer: discoverCommentsContainer(platform),
    commentInput: discoverCommentInputs(platform),
    knownSelectorStatus: checkKnownSelectors(platform),
  };

  // Log summary
  const working = Object.values(result.knownSelectorStatus).filter(v => v === 'found').length;
  const broken = Object.values(result.knownSelectorStatus).filter(v => v === 'not-found').length;

  console.log(`[FeelingWise] ═══ DOM SCAN: ${platform} ═══`);
  console.log(`[FeelingWise] Known selectors: ${working} working, ${broken} broken`);
  console.log(`[FeelingWise] Metrics discovered: ${result.metrics.length}`);
  if (result.metrics.length > 0) {
    console.log(`[FeelingWise] Metric values:`, result.metrics.map(m => `${m.text} (${m.tagName}, svg:${m.hasNearbySVG})`).join(', '));
    console.log(`[FeelingWise] Metric data-attrs:`, result.metrics.map(m => JSON.stringify(m.dataAttributes)).join('\n  '));
  }
  console.log(`[FeelingWise] Comments container:`, result.commentsContainer
    ? `FOUND (${result.commentsContainer.tagName}, ${result.commentsContainer.childCount} children)`
    : 'NOT FOUND');
  console.log(`[FeelingWise] Comment inputs:`, result.commentInput.length > 0
    ? result.commentInput.map(i => `${i.tagName}[${i.placeholder.slice(0, 30)}]`).join(', ')
    : 'NONE');

  // Log broken selectors specifically
  for (const [key, status] of Object.entries(result.knownSelectorStatus)) {
    if (status === 'not-found') {
      console.warn(`[FeelingWise] BROKEN SELECTOR: ${key}`);
    }
  }

  return result;
}

// ─── Metric elements getter (used by video pipeline) ───

export function getDiscoveredMetrics(platform: string): HTMLElement[] {
  // Try known selectors first (fast path)
  // CRITICAL: Use querySelectorAll, not querySelector.
  // TikTok pre-loads multiple videos — each has its own metric elements.
  const known = KNOWN_SELECTORS[platform]?.metrics ?? [];
  const fromKnown: HTMLElement[] = [];
  for (const sel of known) {
    try {
      const els = document.querySelectorAll<HTMLElement>(sel);
      for (const el of els) {
        if (el.dataset.fwMetricHidden !== 'true' && !isInsideNavigation(el)) {
          fromKnown.push(el);
        }
      }
    } catch { /* skip invalid selector */ }
  }

  if (fromKnown.length >= 2) return fromKnown; // Known selectors working fine

  // Structural fallback
  const discovered = discoverMetricElements();
  const elements = discovered
    .filter(m => m.hasNearbySVG && !isInsideNavigation(
      // Re-query to get the actual element for the navigation check
      (() => {
        try { return document.querySelector<HTMLElement>(m.selector); }
        catch { return null; }
      })() as HTMLElement
    ))
    .map(m => {
      try {
        const el = document.querySelector<HTMLElement>(m.selector);
        return el;
      } catch { return null; }
    })
    .filter((el): el is HTMLElement => el !== null && el.dataset.fwMetricHidden !== 'true');

  if (elements.length > fromKnown.length) {
    console.log(`[FeelingWise] Known selectors found ${fromKnown.length}, structural discovery found ${elements.length} — using discovered`);
    return elements;
  }

  return fromKnown;
}

// ─── Comments container getter (used by video pipeline) ───

export function getDiscoveredCommentsContainer(platform: string): HTMLElement | null {
  const result = discoverCommentsContainer(platform);
  if (!result) return null;

  // Re-query to get the actual element
  try {
    return document.querySelector<HTMLElement>(result.selector);
  } catch {
    return null;
  }
}
