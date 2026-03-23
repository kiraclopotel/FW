// FeelingWise - Extension context guard
// Detects MV3 service worker death and stops all future chrome.runtime calls.
// Once the service worker dies, chrome.runtime.sendMessage() throws
// "Extension context invalidated" on every call. This module detects that
// and flips a flag so all subsequent calls become no-ops.

let contextValid = true;

const CONTEXT_INVALIDATED = 'Extension context invalidated';

function isContextError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes(CONTEXT_INVALIDATED);
  }
  return String(err).includes(CONTEXT_INVALIDATED);
}

export function isContextAlive(): boolean {
  return contextValid;
}

/**
 * Wrapper around chrome.runtime.sendMessage that detects context death
 * and stops all future calls. Fire-and-forget: returns undefined if
 * context is dead.
 */
export function safeSendMessage(message: unknown): Promise<unknown> | undefined {
  if (!contextValid) return undefined;

  return chrome.runtime.sendMessage(message as any).catch((err: unknown) => {
    if (isContextError(err)) {
      contextValid = false;
      console.warn('[FeelingWise] Extension context invalidated — stopping all messaging');
    }
    // Swallow all errors (fire-and-forget pattern)
  });
}

/**
 * Called by the processing queue to report errors.
 * Returns true if the queue should stop (context is dead).
 */
let consecutiveContextErrors = 0;
const CONTEXT_ERROR_THRESHOLD = 3;

export function reportProcessingError(err: unknown): boolean {
  if (isContextError(err)) {
    consecutiveContextErrors++;
    if (consecutiveContextErrors >= CONTEXT_ERROR_THRESHOLD) {
      contextValid = false;
      console.warn('[FeelingWise] Queue stopped — extension context dead');
      return true;
    }
  } else {
    consecutiveContextErrors = 0;
  }
  return false;
}
