/**
 * FeelingWise — DOM Comment Container Discovery
 *
 * PURPOSE: Discover platform comment containers by what they ARE, not what they're named.
 * LEGAL BASIS: Reading rendered DOM is equivalent to assistive technology / screen reader.
 * We only observe what the browser already shows the user. No API calls, no server contact.
 *
 * HOW IT WORKS:
 *   Comments: Find containers with 3+ children that each have author link + text
 */

// ─── Types ───

interface ContainerScanResult {
  tagName: string;
  childCount: number;
  selector: string;
  dataAttributes: Record<string, string>;
  sampleChildStructure: string;  // Description of what children contain
}

// ─── Known selector registry ───

const KNOWN_SELECTORS: Record<string, Record<string, string[]>> = {
  tiktok: {
    comments: [
      '[data-e2e="comment-list"]',
      'div[class*="Comment"] > ul',
      'div[class*="comment"] > ul',
    ],
  },
  youtube: {
    comments: ['ytd-comments#comments'],
  },
  instagram: {
    comments: ['article ul[class]'],
  },
};

// ─── Helper functions ───

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
