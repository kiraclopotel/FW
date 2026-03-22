// FeelingWise - Service worker entry point
// Extension lifecycle and message handling.
// WebLLM removed — all AI calls go through src/ai/client.ts (API-based).
// Forensic records are stored here (extension origin) so the dashboard can read them.

import { incrementNeutralized } from '../storage/settings';
import { logForensicEvent } from '../forensics/logger';
import { addVerdict } from '../forensics/feedback-store';
import { updateAuthorProfile } from '../forensics/author-store';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FeelingWise] Extension installed');
});

// Handle messages from content scripts and popup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
chrome.runtime.onMessage.addListener((message: { type: string; payload?: any }, _sender, _sendResponse) => {
  if (message.type === 'NEUTRALIZATION_COMPLETE') {
    incrementNeutralized();
  }

  if (message.type === 'FORENSIC_LOG' && message.payload) {
    const p = message.payload;
    // Store forensic record in extension-origin IndexedDB so the dashboard can read it
    logForensicEvent(
      p.originalText,
      p.neutralizedText,
      p.analysis,
      p.mode,
      p.platform,
      p.aiSource,
      p.author,
      p.postUrl,
      p.feedSource ?? 'unknown',
    ).catch(err => { console.error('[FeelingWise] Service worker forensic log failed:', err); });
  }

  if (message.type === 'USER_VERDICT' && message.payload) {
    const p = message.payload;
    addVerdict({
      postId: p.postId,
      verdict: p.verdict,
      mode: p.mode,
      timestamp: new Date().toISOString(),
    }).catch(err => { console.error('[FeelingWise] Verdict storage failed:', err); });
  }

  if (message.type === 'AUTHOR_UPDATE' && message.payload) {
    const p = message.payload;
    updateAuthorProfile(p.author, p.platform, p.flagged, p.techniques)
      .catch(err => { console.error('[FeelingWise] Author profile update failed:', err); });
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    // Side panel opening logic (Phase future)
    console.log('[FeelingWise] Side panel requested');
  }

  // Return true for async handlers (IndexedDB writes) to keep the message channel
  // open long enough for the async work to complete. No sendResponse needed —
  // content scripts don't await a response; returning true just prevents Chrome
  // from closing the port prematurely.
  if (message.type === 'FORENSIC_LOG' || message.type === 'USER_VERDICT' || message.type === 'AUTHOR_UPDATE') {
    return true;
  }

  return false;
});
