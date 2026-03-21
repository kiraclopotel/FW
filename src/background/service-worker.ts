// FeelingWise - Service worker entry point
// Extension lifecycle, message listener registration, model initialization

import { initialize, getEngine, isReady } from '../ai/local/model-manager';

// Initialize model on service worker startup (handles re-activation after idle)
initialize();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FeelingWise] Extension installed');
  // Trigger model download on first install
  initialize();
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FW_INFER') {
    handleInference(message.system, message.user).then(text => {
      sendResponse({ text });
    });
    return true; // Keep message channel open for async sendResponse
  }

  if (message.type === 'analysis-result') {
    console.log('[FeelingWise] Received analysis result', message.data);
  }

  return false;
});

async function handleInference(system: string, user: string): Promise<string> {
  if (!isReady()) {
    // Try to initialize if not ready
    await initialize();
    if (!isReady()) return '';
  }

  const engine = getEngine();
  if (!engine) return '';

  try {
    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });
    return reply.choices[0]?.message?.content ?? '';
  } catch (err) {
    console.error('[FeelingWise] Service worker inference failed:', err);
    return '';
  }
}
