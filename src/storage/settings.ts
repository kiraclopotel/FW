// FeelingWise - User settings (chrome.storage.local)

import { Mode } from '../types/mode';

export interface FWSettings {
  mode: Mode;

  // API configuration — user's own key OR managed credits
  apiProvider: 'anthropic' | 'openai' | 'deepseek' | 'gemini' | 'managed';
  anthropicApiKey: string;
  openaiApiKey: string;
  deepSeekApiKey: string;
  geminiApiKey: string;
  managedCredits: number;

  // Usage controls
  dailyCap: number;
  deepScanEnabled: boolean;

  // Stats
  totalChecksToday: number;
  totalNeutralizedToday: number;
  lastResetDate: string;
}

const SETTINGS_KEYS: (keyof FWSettings)[] = [
  'mode', 'apiProvider',
  'anthropicApiKey', 'openaiApiKey', 'deepSeekApiKey', 'geminiApiKey',
  'managedCredits', 'dailyCap', 'deepScanEnabled',
  'totalChecksToday', 'totalNeutralizedToday', 'lastResetDate',
];

const DEFAULTS: FWSettings = {
  mode: 'adult',
  apiProvider: 'deepseek',
  anthropicApiKey: '',
  openaiApiKey: '',
  deepSeekApiKey: '',
  geminiApiKey: '',
  managedCredits: 0,
  dailyCap: 200,
  deepScanEnabled: false,
  totalChecksToday: 0,
  totalNeutralizedToday: 0,
  lastResetDate: new Date().toDateString(),
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

    // Reset daily counters if new day
    const today = new Date().toDateString();
    if (settings.lastResetDate !== today) {
      settings.totalChecksToday = 0;
      settings.totalNeutralizedToday = 0;
      settings.lastResetDate = today;
      await chrome.storage.local.set({
        totalChecksToday: 0,
        totalNeutralizedToday: 0,
        lastResetDate: today,
      });
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
  });
}

export async function incrementNeutralized(): Promise<void> {
  const settings = await getSettings();
  await chrome.storage.local.set({
    totalNeutralizedToday: settings.totalNeutralizedToday + 1,
  });
}

export async function consumeCredits(amount: number): Promise<boolean> {
  const settings = await getSettings();
  if (settings.managedCredits < amount) return false;
  await chrome.storage.local.set({
    managedCredits: settings.managedCredits - amount,
  });
  return true;
}
