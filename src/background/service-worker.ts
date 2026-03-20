// FeelingWise - Service worker entry point
// Extension lifecycle, message listener registration

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FeelingWise] Extension installed');
});

// Phase 4+: message routing between content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'analysis-result') {
    // Forward to side panel when implemented
    console.log('[FeelingWise] Received analysis result', message.data);
  }
  return false;
});
