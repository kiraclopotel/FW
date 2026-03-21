// FeelingWise - Service worker entry point
// Extension lifecycle and message handling.
// WebLLM removed — all AI calls go through src/ai/client.ts (API-based).
// Forensic records are stored here (extension origin) so the dashboard can read them.

import { incrementNeutralized } from '../storage/settings';
import { logForensicEvent } from '../forensics/logger';
import { AnalysisResult } from '../types/analysis';
import { Platform } from '../types/post';
import { Mode } from '../types/mode';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FeelingWise] Extension installed');
});

interface ForensicLogPayload {
  originalText: string;
  neutralizedText: string;
  analysis: AnalysisResult;
  mode: Mode;
  platform: Platform;
  aiSource: 'local' | 'cloud';
  author?: string;
  postUrl?: string;
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: { type: string; payload?: ForensicLogPayload }, _sender, _sendResponse) => {
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
    ).catch(err => { console.error('[FeelingWise] Service worker forensic log failed:', err); });
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    // Side panel opening logic (Phase future)
    console.log('[FeelingWise] Side panel requested');
  }

  return false;
});
