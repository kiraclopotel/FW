// FeelingWise - DeepSeek cloud provider
// API integration for DeepSeek (stub — Phase 7)

import { CloudProvider } from './provider';

export const deepseekProvider: CloudProvider = {
  name: 'deepseek',
  async send(_system: string, _user: string): Promise<string> {
    return '';
  },
};
