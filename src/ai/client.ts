// FeelingWise - Multi-provider AI client
// Single entry point for all AI calls. Supports Anthropic, OpenAI, DeepSeek, Gemini, and managed credits.

import { getSettings, incrementChecks, consumeCredits, trackTokenUsage } from '../storage/settings';
import { safeSendMessage } from '../content/context-guard';

let notifiedConnected = false;

let lastCallMeta: { model: string; provider: string } | null = null;
export function getLastCallMeta() { return lastCallMeta; }

export async function callAI(system: string, user: string, fastMode = true): Promise<string> {
  const settings = await getSettings();

  // Check daily cap
  if (settings.dailyCap > 0 && settings.totalChecksToday >= settings.dailyCap) {
    console.log('[FeelingWise] Daily cap reached — PASS');
    return '';
  }

  // Check if any provider configured
  const hasKey =
    settings.anthropicApiKey ||
    settings.openaiApiKey ||
    settings.deepSeekApiKey ||
    settings.geminiApiKey ||
    settings.managedCredits > 0;

  if (!hasKey) {
    console.log('[FeelingWise] No API configured — PASS');
    safeSendMessage({ type: 'FW_API_DISCONNECTED' });
    return '';
  }

  switch (settings.apiProvider) {
    case 'anthropic':
      return callAnthropic(system, user, settings.anthropicApiKey, fastMode);
    case 'openai':
      return callOpenAI(system, user, settings.openaiApiKey, fastMode);
    case 'deepseek':
      return callDeepSeek(system, user, settings.deepSeekApiKey, fastMode);
    case 'gemini':
      return callGemini(system, user, settings.geminiApiKey, fastMode);
    case 'managed':
      return callManaged(system, user, fastMode);
    default:
      return '';
  }
}

function notifyConnected(): void {
  if (!notifiedConnected) {
    notifiedConnected = true;
    safeSendMessage({ type: 'FW_API_CONNECTED' });
  }
}

async function callAnthropic(system: string, user: string, apiKey: string, fast: boolean): Promise<string> {
  if (!apiKey) return '';
  notifyConnected();
  const model = fast ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error('[FeelingWise] Anthropic error:', data.error.message);
      return '';
    }
    if (data.usage) {
      await trackTokenUsage(data.usage.input_tokens || 0, data.usage.output_tokens || 0, 'anthropic');
    }
    const text = data.content?.[0]?.text ?? '';
    if (text) {
      await incrementChecks();
      lastCallMeta = { model, provider: 'anthropic' };
    } else {
      lastCallMeta = null;
    }
    return text;
  } catch {
    lastCallMeta = null;
    return '';
  }
}

async function callOpenAI(system: string, user: string, apiKey: string, fast: boolean): Promise<string> {
  if (!apiKey) return '';
  notifyConnected();
  const model = fast ? 'gpt-4o-mini' : 'gpt-4o';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error('[FeelingWise] OpenAI error:', data.error.message);
      return '';
    }
    if (data.usage) {
      await trackTokenUsage(data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, 'openai');
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    if (text) {
      await incrementChecks();
      lastCallMeta = { model, provider: 'openai' };
    } else {
      lastCallMeta = null;
    }
    return text;
  } catch {
    lastCallMeta = null;
    return '';
  }
}

async function callDeepSeek(system: string, user: string, apiKey: string, fast: boolean): Promise<string> {
  if (!apiKey) return '';
  notifyConnected();
  const model = fast ? 'deepseek-chat' : 'deepseek-reasoner';
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error('[FeelingWise] DeepSeek error:', data.error.message);
      return '';
    }
    if (data.usage) {
      await trackTokenUsage(data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, 'deepseek');
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    if (text) {
      await incrementChecks();
      lastCallMeta = { model, provider: 'deepseek' };
    } else {
      lastCallMeta = null;
    }
    return text;
  } catch {
    lastCallMeta = null;
    return '';
  }
}

async function callGemini(system: string, user: string, apiKey: string, fast: boolean): Promise<string> {
  if (!apiKey) return '';
  notifyConnected();
  const model = fast ? 'gemini-2.0-flash' : 'gemini-2.0-flash-thinking-exp';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    );
    const data = await res.json();
    if (data.error) {
      console.error('[FeelingWise] Gemini error:', data.error.message);
      return '';
    }
    if (data.usageMetadata) {
      await trackTokenUsage(data.usageMetadata.promptTokenCount || 0, data.usageMetadata.candidatesTokenCount || 0, 'gemini');
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (text) {
      await incrementChecks();
      lastCallMeta = { model, provider: 'gemini' };
    } else {
      lastCallMeta = null;
    }
    return text;
  } catch {
    lastCallMeta = null;
    return '';
  }
}

async function callManaged(system: string, _user: string, _fast: boolean): Promise<string> {
  // Placeholder for managed credits backend (future phase)
  const consumed = await consumeCredits(1);
  if (!consumed) {
    console.log('[FeelingWise] Credits exhausted — PASS');
    return '';
  }
  // In production: this would hit our backend which holds our API key
  // For now return '' (managed mode not yet live)
  void system;
  return '';
}
