// FeelingWise - Selector chain utility
// Resilient DOM querying with fallback selectors.
// When platforms change their DOM structure, primary selectors fail.
// This utility tries selectors in priority order and logs when fallbacks are needed.

/**
 * Query a single element using a prioritized list of selectors.
 * Returns the first match, or null if all fail.
 */
export function queryWithFallback(
  root: Element | Document,
  selectors: string[],
  label?: string,
): Element | null {
  for (let i = 0; i < selectors.length; i++) {
    try {
      const result = root.querySelector(selectors[i]);
      if (result) {
        if (i > 0 && label) {
          console.warn(
            `[FeelingWise] ${label}: primary selector failed, using fallback #${i}: "${selectors[i]}"`,
          );
        }
        return result;
      }
    } catch {
      // Invalid selector — skip
    }
  }
  return null;
}

/**
 * Query all matching elements using a prioritized list of selectors.
 * Uses the FIRST selector that returns any results.
 */
export function queryAllWithFallback(
  root: Element | Document,
  selectors: string[],
  label?: string,
): Element[] {
  for (let i = 0; i < selectors.length; i++) {
    try {
      const results = root.querySelectorAll(selectors[i]);
      if (results.length > 0) {
        if (i > 0 && label) {
          console.warn(
            `[FeelingWise] ${label}: primary selector failed, using fallback #${i}: "${selectors[i]}"`,
          );
        }
        return Array.from(results);
      }
    } catch {
      // Invalid selector — skip
    }
  }
  return [];
}

/**
 * Extract text content from an element, trying child selectors in order.
 * Returns the trimmed text of the first match with substantial content (>minLength chars).
 */
export function extractTextWithFallback(
  root: Element,
  selectors: string[],
  minLength = 20,
  label?: string,
): { element: HTMLElement; text: string } | null {
  for (let i = 0; i < selectors.length; i++) {
    try {
      const candidates = root.querySelectorAll<HTMLElement>(selectors[i]);
      for (const el of candidates) {
        const text = el.textContent?.trim() ?? '';
        if (text.length >= minLength) {
          if (i > 0 && label) {
            console.warn(
              `[FeelingWise] ${label}: primary text selector failed, using fallback #${i}`,
            );
          }
          return { element: el, text };
        }
      }
    } catch {
      // Invalid selector — skip
    }
  }
  return null;
}
