// FeelingWise - Service worker entry point
// Extension lifecycle and message handling.
// WebLLM removed — all AI calls go through src/ai/client.ts (API-based).

import { incrementNeutralized } from '../storage/settings';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FeelingWise] Extension installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: { type: string }, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
  if (message.type === 'NEUTRALIZATION_COMPLETE') {
    incrementNeutralized();
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    // Side panel opening logic (Phase future)
    console.log('[FeelingWise] Side panel requested');
  }

  return false;
});
