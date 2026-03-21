// FeelingWise - Gemini cloud provider
// API integration for Gemini (stub — Phase 7)

import { CloudProvider } from './provider';

export const geminiProvider: CloudProvider = {
  name: 'gemini',
  async send(_system: string, _user: string): Promise<string> {
    return '';
  },
};
