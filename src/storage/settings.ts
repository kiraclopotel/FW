// FeelingWise - User settings (chrome.storage.local)

import { Mode } from '../types/mode';

export interface FWSettings {
  cloudEnabled: boolean;
  mode: Mode;
}

const DEFAULTS: FWSettings = {
  cloudEnabled: false,
  mode: 'adult',
};

export async function getSettings(): Promise<FWSettings> {
  try {
    const result = await chrome.storage.local.get(['cloudEnabled', 'mode']);
    return {
      cloudEnabled: (result.cloudEnabled as boolean | undefined) ?? DEFAULTS.cloudEnabled,
      mode: (result.mode as Mode | undefined) ?? DEFAULTS.mode,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(settings: Partial<FWSettings>): Promise<void> {
  await chrome.storage.local.set(settings);
}
