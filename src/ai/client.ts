// FeelingWise - Multi-provider AI client
// Single entry point for all AI calls. Supports 10 cloud providers and managed credits.

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
    settings.groqApiKey ||
    settings.mistralApiKey ||
    settings.xaiApiKey ||
    settings.openRouterApiKey ||
    settings.togetherApiKey ||
    settings.cohereApiKey ||
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
      return callOpenAICompatible(system, user, settings.openaiApiKey, fastMode, {
        provider: 'openai',
        url: 'https://api.openai.com/v1/chat/completions',
        fastModel: 'gpt-4o-mini',
        qualityModel: 'gpt-4o',
      });
    case 'deepseek':
      return callOpenAICompatible(system, user, settings.deepSeekApiKey, fastMode, {
        provider: 'deepseek',
        url: 'https://api.deepseek.com/v1/chat/completions',
        fastModel: 'deepseek-chat',
        qualityModel: 'deepseek-reasoner',
        maxTokens: 512,
        temperature: 0.3,
      });
    case 'gemini':
      return callGemini(system, user, settings.geminiApiKey, fastMode);
    case 'groq':
      return callOpenAICompatible(system, user, settings.groqApiKey, fastMode, {
        provider: 'groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        fastModel: 'llama-3.1-8b-instant',
        qualityModel: 'llama-3.3-70b-versatile',
      });
    case 'mistral':
      return callOpenAICompatible(system, user, settings.mistralApiKey, fastMode, {
        provider: 'mistral',
        url: 'https://api.mistral.ai/v1/chat/completions',
        fastModel: 'mistral-small-latest',
        qualityModel: 'mistral-large-latest',
      });
    case 'xai':
      return callOpenAICompatible(system, user, settings.xaiApiKey, fastMode, {
        provider: 'xai',
        url: 'https://api.x.ai/v1/chat/completions',
        fastModel: 'grok-2',
        qualityModel: 'grok-2-latest',
      });
    case 'openrouter':
      return callOpenAICompatible(system, user, settings.openRouterApiKey, fastMode, {
        provider: 'openrouter',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        fastModel: 'meta-llama/llama-3.1-8b-instruct',
        qualityModel: 'anthropic/claude-3.5-sonnet',
        extraHeaders: { 'HTTP-Referer': 'https://feelingwise.com' },
      });
    case 'together':
      return callOpenAICompatible(system, user, settings.togetherApiKey, fastMode, {
        provider: 'together',
        url: 'https://api.together.xyz/v1/chat/completions',
        fastModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        qualityModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      });
    case 'cohere':
      return callCohere(system, user, settings.cohereApiKey, fastMode);
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

// ─── Shared OpenAI-compatible caller ───

interface OpenAICompatibleConfig {
  provider: string;
  url: string;
  fastModel: string;
  qualityModel: string;
  maxTokens?: number;
  temperature?: number;
  extraHeaders?: Record<string, string>;
}

async function callOpenAICompatible(
  system: string,
  user: string,
  apiKey: string,
  fast: boolean,
  config: OpenAICompatibleConfig
): Promise<string> {
  if (!apiKey) return '';
  notifyConnected();
  const model = fast ? config.fastModel : config.qualityModel;
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...config.extraHeaders,
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxTokens ?? 1024,
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error(`[FeelingWise] ${config.provider} error:`, data.error.message);
      return '';
    }
    if (data.usage) {
      await trackTokenUsage(
        data.usage.prompt_tokens || 0,
        data.usage.completion_tokens || 0,
        config.provider
      );
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    if (text) {
      await incrementChecks();
      lastCallMeta = { model, provider: config.provider };
    } else {
      lastCallMeta = null;
    }
    return text;
  } catch {
    lastCallMeta = null;
    return '';
  }
}

// ─── Anthropic (unique format) ───

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

// ─── Gemini (unique format) ───

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

// ─── Cohere (unique v2 format) ───

async function callCohere(system: string, user: string, apiKey: string, fast: boolean): Promise<string> {
  if (!apiKey) return '';
  notifyConnected();
  const model = fast ? 'command-r' : 'command-r-plus';
  try {
    const res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 1024,
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error('[FeelingWise] Cohere error:', data.error?.message ?? data.message);
      return '';
    }
    if (data.usage?.billed_units) {
      await trackTokenUsage(
        data.usage.billed_units.input_tokens || 0,
        data.usage.billed_units.output_tokens || 0,
        'cohere'
      );
    }
    const text = data.message?.content?.[0]?.text ?? '';
    if (text) {
      await incrementChecks();
      lastCallMeta = { model, provider: 'cohere' };
    } else {
      lastCallMeta = null;
    }
    return text;
  } catch {
    lastCallMeta = null;
    return '';
  }
}

// ─── Managed credits (future) ───

async function callManaged(system: string, _user: string, _fast: boolean): Promise<string> {
  const consumed = await consumeCredits(1);
  if (!consumed) {
    console.log('[FeelingWise] Credits exhausted — PASS');
    return '';
  }
  void system;
  return '';
}
