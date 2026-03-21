// FeelingWise - OpenAI cloud provider
// API integration for OpenAI (stub — Phase 7)

import { CloudProvider } from './provider';

export const openaiProvider: CloudProvider = {
  name: 'openai',
  async send(_system: string, _user: string): Promise<string> {
    return '';
  },
};
