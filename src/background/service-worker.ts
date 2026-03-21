// FeelingWise - Service worker entry point
// Extension lifecycle, message listener registration, model initialization

import { initialize } from '../ai/local/model-manager';

// Initialize model on service worker startup (handles re-activation after idle)
initialize();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FeelingWise] Extension installed');
  // Trigger model download on first install
  initialize();
});

// Phase 4+: message routing between content scripts and side panel
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'analysis-result') {
    // Forward to side panel when implemented
    console.log('[FeelingWise] Received analysis result', message.data);
  }
  return false;
});
