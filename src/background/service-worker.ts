// FeelingWise - Service worker entry point
// Extension lifecycle and message handling.
// WebLLM removed — all AI calls go through src/ai/client.ts (API-based).
// Forensic records are stored here (extension origin) so the dashboard can read them.

import { incrementNeutralized, getSettings } from '../storage/settings';
import { logForensicEvent } from '../forensics/logger';
import { addVerdict } from '../forensics/feedback-store';
import { updateAuthorProfile } from '../forensics/author-store';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FeelingWise] Extension installed');
  chrome.action.setBadgeText({ text: '' });
});

// Handle messages from content scripts and popup.
//
// IMPORTANT: For async handlers (IndexedDB writes), we return true AND call
// sendResponse when done. This keeps the service worker alive until the write
// completes — without sendResponse, Chrome closes the message channel and logs:
// "A listener indicated an asynchronous response by returning true, but the
// message channel closed before a response was received"
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
chrome.runtime.onMessage.addListener((message: { type: string; payload?: any }, _sender, sendResponse) => {
  if (message.type === 'NEUTRALIZATION_COMPLETE') {
    incrementNeutralized().then(async () => {
      const settings = await getSettings();
      chrome.action.setBadgeText({ text: String(settings.totalNeutralizedToday) });
      chrome.action.setBadgeBackgroundColor({ color: '#00bcd4' });
    });
    // Fire-and-forget — no sendResponse needed, content script doesn't await
    return false;
  }

  if (message.type === 'FORENSIC_LOG' && message.payload) {
    const p = message.payload;
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
      p.aiModel,
      p.aiProvider,
      p.detectionMode,
      p.configSnapshot,
    )
      .then(() => sendResponse({ ok: true }))
      .catch(err => {
        console.error('[FeelingWise] Service worker forensic log failed:', err);
        sendResponse({ ok: false });
      });
    return true; // Keep channel open for async sendResponse
  }

  if (message.type === 'USER_VERDICT' && message.payload) {
    const p = message.payload;
    addVerdict({
      postId: p.postId,
      verdict: p.verdict,
      mode: p.mode,
      timestamp: new Date().toISOString(),
    })
      .then(() => sendResponse({ ok: true }))
      .catch(err => {
        console.error('[FeelingWise] Verdict storage failed:', err);
        sendResponse({ ok: false });
      });
    return true; // Keep channel open for async sendResponse
  }

  if (message.type === 'AUTHOR_UPDATE' && message.payload) {
    const p = message.payload;
    updateAuthorProfile(p.author, p.platform, p.flagged, p.techniques)
      .then(() => sendResponse({ ok: true }))
      .catch(err => {
        console.error('[FeelingWise] Author profile update failed:', err);
        sendResponse({ ok: false });
      });
    return true; // Keep channel open for async sendResponse
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    console.log('[FeelingWise] Side panel requested');
  }

  return false;
});

// Clear badge when daily stats reset (lastResetDate changes)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.lastResetDate) {
    chrome.action.setBadgeText({ text: '' });
  }
});
