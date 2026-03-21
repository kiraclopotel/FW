// FeelingWise - Anthropic cloud provider
// API integration for Anthropic (stub — Phase 7)

import { CloudProvider } from './provider';

export const anthropicProvider: CloudProvider = {
  name: 'anthropic',
  async send(_system: string, _user: string): Promise<string> {
    // Stub: returns empty string until Phase 7
    return '';
  },
};
