// FeelingWise - User settings (chrome.storage.local)

import { Mode } from '../types/mode';
import { sha256 } from '../forensics/hasher';

export type EducationalTopic =
  | 'science' | 'nature' | 'history' | 'math'
  | 'languages' | 'philosophy' | 'arts' | 'technology';

export interface VideoControls {
  childCommentMode: 'hidden' | 'educational';
  childHideMetrics: boolean;
  childBlockPosting: boolean;
  teenRewriteComments: boolean;
  teenHideMetrics: boolean;
  teenShowLessons: boolean;
  adultCleanLanguage: boolean;
  adultHideMetrics: boolean;
  commentAnalysisCount: number;
  educationalTopics: EducationalTopic[];
}

export interface FWSettings {
  mode: Mode;

  // API configuration — user's own key OR managed credits
  apiProvider: 'anthropic' | 'openai' | 'deepseek' | 'gemini' | 'managed';
  anthropicApiKey: string;
  openaiApiKey: string;
  deepSeekApiKey: string;
  geminiApiKey: string;
  managedCredits: number;

  // Parent PIN (SHA-256 hash, '' = no PIN set)
  parentPin: string;

  // Usage controls
  dailyCap: number;
  deepScanEnabled: boolean;

  // Language
  locale: 'en' | 'ro';

  // Stats — daily (reset each day)
  totalChecksToday: number;
  totalNeutralizedToday: number;
  totalTokensToday: number;         // cumulative input + output tokens
  estimatedCostToday: number;       // estimated cost in USD cents
  lastResetDate: string;

  // Stats — all-time (never reset)
  totalTokensAllTime: number;
  totalChecksAllTime: number;
  totalNeutralizedAllTime: number;
  estimatedCostAllTime: number;     // in USD cents, never resets

  // Video platform controls (parent-configured, PIN-protected)
  videoControls: VideoControls;
}

const SETTINGS_KEYS: (keyof FWSettings)[] = [
  'mode', 'apiProvider',
  'anthropicApiKey', 'openaiApiKey', 'deepSeekApiKey', 'geminiApiKey',
  'managedCredits', 'parentPin', 'dailyCap', 'deepScanEnabled', 'locale',
  'totalChecksToday', 'totalNeutralizedToday', 'totalTokensToday', 'estimatedCostToday', 'lastResetDate',
  'totalTokensAllTime', 'totalChecksAllTime', 'totalNeutralizedAllTime', 'estimatedCostAllTime',
  'videoControls',
];

const DEFAULTS: FWSettings = {
  mode: 'adult',
  apiProvider: 'deepseek',
  anthropicApiKey: '',
  openaiApiKey: '',
  deepSeekApiKey: '',
  geminiApiKey: '',
  managedCredits: 0,
  parentPin: '',
  dailyCap: 5000,
  deepScanEnabled: false,
  locale: 'en',
  totalChecksToday: 0,
  totalNeutralizedToday: 0,
  totalTokensToday: 0,
  estimatedCostToday: 0,
  lastResetDate: new Date().toDateString(),
  totalTokensAllTime: 0,
  totalChecksAllTime: 0,
  totalNeutralizedAllTime: 0,
  estimatedCostAllTime: 0,
  videoControls: {
    childCommentMode: 'educational',
    childHideMetrics: true,
    childBlockPosting: true,
    teenRewriteComments: true,
    teenHideMetrics: true,
    teenShowLessons: true,
    adultCleanLanguage: false,
    adultHideMetrics: false,
    commentAnalysisCount: 15,
    educationalTopics: ['science', 'nature', 'history', 'math', 'languages', 'philosophy'],
  },
};

export async function getSettings(): Promise<FWSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEYS);
    const settings: FWSettings = { ...DEFAULTS };
    for (const key of SETTINGS_KEYS) {
      if (result[key] !== undefined) {
        (settings as unknown as Record<string, unknown>)[key] = result[key];
      }
    }

    // Migration: add videoControls defaults for existing users
    if (!settings.videoControls) {
      settings.videoControls = { ...DEFAULTS.videoControls };
    }

    // Reset daily counters if new day
    const today = new Date().toDateString();
    if (settings.lastResetDate !== today) {
      settings.totalChecksToday = 0;
      settings.totalNeutralizedToday = 0;
      settings.totalTokensToday = 0;
      settings.estimatedCostToday = 0;
      settings.lastResetDate = today;
      try {
        await chrome.storage.local.set({
          totalChecksToday: 0,
          totalNeutralizedToday: 0,
          totalTokensToday: 0,
          estimatedCostToday: 0,
          lastResetDate: today,
        });
      } catch {
        // Daily reset write failed — continue with in-memory reset values
      }
    }

    return settings;
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(partial: Partial<FWSettings>): Promise<void> {
  await chrome.storage.local.set(partial);
}

export async function incrementChecks(): Promise<void> {
  const settings = await getSettings();
  await chrome.storage.local.set({
    totalChecksToday: settings.totalChecksToday + 1,
    totalChecksAllTime: settings.totalChecksAllTime + 1,
  });
}

export async function incrementNeutralized(): Promise<void> {
  const settings = await getSettings();
  await chrome.storage.local.set({
    totalNeutralizedToday: settings.totalNeutralizedToday + 1,
    totalNeutralizedAllTime: settings.totalNeutralizedAllTime + 1,
  });
}

export async function trackTokenUsage(inputTokens: number, outputTokens: number, provider: string): Promise<void> {
  const settings = await getSettings();
  const totalNew = inputTokens + outputTokens;

  // Approximate cost per 1M tokens (in USD cents) — input/output averaged
  const costPer1M: Record<string, number> = {
    'deepseek': 8,     // ~$0.08/1M (89% cache hits at $0.028/1M + 11% misses at $0.28/1M)
    'anthropic': 80,   // ~$0.80/1M tokens (Haiku average)
    'openai': 15,      // ~$0.15/1M tokens (GPT-4o-mini average)
    'gemini': 10,      // ~$0.10/1M tokens (Flash average)
    'managed': 0,
  };

  const rate = costPer1M[provider] ?? 20;
  const costCents = (totalNew / 1_000_000) * rate;

  await chrome.storage.local.set({
    totalTokensToday: settings.totalTokensToday + totalNew,
    estimatedCostToday: Math.round((settings.estimatedCostToday + costCents) * 100) / 100,
    totalTokensAllTime: settings.totalTokensAllTime + totalNew,
    estimatedCostAllTime: Math.round((settings.estimatedCostAllTime + costCents) * 100) / 100,
  });
}

export async function resetDailyStats(): Promise<void> {
  await chrome.storage.local.set({
    totalChecksToday: 0,
    totalNeutralizedToday: 0,
    totalTokensToday: 0,
    estimatedCostToday: 0,
    lastResetDate: new Date().toDateString(),
  });
}

export async function validateApiKey(): Promise<{ valid: boolean; provider: string }> {
  try {
    const settings = await getSettings();
    const provider = settings.apiProvider;
    let valid = false;
    switch (provider) {
      case 'anthropic': valid = !!settings.anthropicApiKey; break;
      case 'openai': valid = !!settings.openaiApiKey; break;
      case 'deepseek': valid = !!settings.deepSeekApiKey; break;
      case 'gemini': valid = !!settings.geminiApiKey; break;
      case 'managed': valid = settings.managedCredits > 0; break;
    }
    return { valid, provider };
  } catch {
    return { valid: false, provider: 'unknown' };
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.parentPin) return false;
  const hash = await sha256(pin);
  return hash === settings.parentPin;
}

export async function setPin(pin: string): Promise<void> {
  const hash = await sha256(pin);
  await chrome.storage.local.set({ parentPin: hash });
}

export async function consumeCredits(amount: number): Promise<boolean> {
  const settings = await getSettings();
  if (settings.managedCredits < amount) return false;
  await chrome.storage.local.set({
    managedCredits: settings.managedCredits - amount,
  });
  return true;
}
