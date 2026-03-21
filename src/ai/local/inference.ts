// FeelingWise - Local inference wrapper
// Proxies inference requests to the service worker via chrome.runtime.sendMessage.
// The service worker holds the WebLLM engine; content scripts cannot use WebGPU.

export async function runInference(system: string, user: string): Promise<string> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FW_INFER',
      system,
      user,
    });
    return response?.text ?? '';
  } catch (err) {
    console.error('[FeelingWise] Inference message failed:', err);
    return '';
  }
}
