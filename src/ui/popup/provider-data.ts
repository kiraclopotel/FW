// FeelingWise — provider metadata for UI

import { FWSettings } from '../../storage/settings';

export type ProviderId =
  | 'groq' | 'gemini' | 'together' | 'mistral' | 'deepseek'
  | 'openai' | 'xai' | 'openrouter' | 'cohere' | 'anthropic';

export type SpeedTier = 'ultra-fast' | 'fast' | 'moderate' | 'slow';
export type CostTier = '$' | '$$' | '$$$';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  tagline: string;
  placeholder: string;
  link: string;
  linkLabel: string;
  speed: SpeedTier;
  costTier: CostTier;
  costPer1kChecks: string;
  recommendation?: string;
  signupSteps: string[];
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'groq',
    label: 'Groq',
    tagline: 'Ultra-fast inference',
    placeholder: 'gsk_...',
    link: 'https://console.groq.com',
    linkLabel: 'console.groq.com',
    speed: 'ultra-fast',
    costTier: '$',
    costPer1kChecks: '$0.003',
    recommendation: 'Fastest',
    signupSteps: [
      'Go to console.groq.com and sign up (free)',
      'Click "API Keys" in the left sidebar',
      'Click "Create API Key" and copy it',
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    tagline: 'Fast — Google AI',
    placeholder: 'AIza...',
    link: 'https://aistudio.google.com',
    linkLabel: 'aistudio.google.com',
    speed: 'fast',
    costTier: '$',
    costPer1kChecks: '$0.010',
    signupSteps: [
      'Go to aistudio.google.com',
      'Sign in with your Google account',
      'Click "Get API Key" → "Create API key"',
      'Copy the key starting with AIza',
    ],
  },
  {
    id: 'together',
    label: 'Together',
    tagline: 'Fast open-source models',
    placeholder: 'tok_...',
    link: 'https://api.together.xyz',
    linkLabel: 'api.together.xyz',
    speed: 'fast',
    costTier: '$',
    costPer1kChecks: '$0.005',
    signupSteps: [
      'Go to api.together.xyz and sign up',
      'Navigate to Settings → API Keys',
      'Create a new key and copy it',
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    tagline: 'Fast European AI',
    placeholder: 'key...',
    link: 'https://console.mistral.ai',
    linkLabel: 'console.mistral.ai',
    speed: 'fast',
    costTier: '$',
    costPer1kChecks: '$0.010',
    signupSteps: [
      'Go to console.mistral.ai and create an account',
      'Navigate to "API Keys" section',
      'Click "Create new key" and copy it',
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    tagline: 'Cheapest — Best value',
    placeholder: 'sk-...',
    link: 'https://console.deepseek.com',
    linkLabel: 'console.deepseek.com',
    speed: 'slow',
    costTier: '$',
    costPer1kChecks: '$0.008',
    recommendation: 'Best Value',
    signupSteps: [
      'Go to console.deepseek.com and sign up',
      'Click "API Keys" in the sidebar',
      'Create a new API key and copy it',
    ],
  },
  {
    id: 'openai',
    label: 'GPT',
    tagline: 'Reliable — OpenAI',
    placeholder: 'sk-...',
    link: 'https://platform.openai.com',
    linkLabel: 'platform.openai.com',
    speed: 'moderate',
    costTier: '$$',
    costPer1kChecks: '$0.015',
    signupSteps: [
      'Go to platform.openai.com and sign in',
      'Navigate to API Keys section',
      'Click "Create new secret key" and copy it',
    ],
  },
  {
    id: 'xai',
    label: 'Grok',
    tagline: 'Moderate — xAI',
    placeholder: 'xai-...',
    link: 'https://console.x.ai',
    linkLabel: 'console.x.ai',
    speed: 'moderate',
    costTier: '$$',
    costPer1kChecks: '$0.020',
    signupSteps: [
      'Go to console.x.ai and sign up',
      'Navigate to API Keys',
      'Create a new key and copy it',
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    tagline: 'Access to 100+ models',
    placeholder: 'sk-or-...',
    link: 'https://openrouter.ai/keys',
    linkLabel: 'openrouter.ai',
    speed: 'moderate',
    costTier: '$$',
    costPer1kChecks: '$0.015',
    recommendation: 'Most Models',
    signupSteps: [
      'Go to openrouter.ai and sign up',
      'Click your profile → "Keys"',
      'Create a new key and copy it',
    ],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    tagline: 'Moderate — Enterprise AI',
    placeholder: 'key...',
    link: 'https://dashboard.cohere.com',
    linkLabel: 'dashboard.cohere.com',
    speed: 'moderate',
    costTier: '$',
    costPer1kChecks: '$0.010',
    signupSteps: [
      'Go to dashboard.cohere.com and sign up',
      'Navigate to API Keys section',
      'Copy your default key or create a new one',
    ],
  },
  {
    id: 'anthropic',
    label: 'Claude',
    tagline: 'Best quality — Anthropic',
    placeholder: 'sk-ant-...',
    link: 'https://console.anthropic.com',
    linkLabel: 'console.anthropic.com',
    speed: 'moderate',
    costTier: '$$$',
    costPer1kChecks: '$0.080',
    recommendation: 'Best Quality',
    signupSteps: [
      'Go to console.anthropic.com and sign up',
      'Navigate to "API Keys"',
      'Click "Create Key" and copy it',
    ],
  },
];

export function keyForProvider(provider: ProviderId): keyof FWSettings {
  switch (provider) {
    case 'anthropic': return 'anthropicApiKey';
    case 'openai': return 'openaiApiKey';
    case 'deepseek': return 'deepSeekApiKey';
    case 'gemini': return 'geminiApiKey';
    case 'groq': return 'groqApiKey';
    case 'mistral': return 'mistralApiKey';
    case 'xai': return 'xaiApiKey';
    case 'openrouter': return 'openRouterApiKey';
    case 'together': return 'togetherApiKey';
    case 'cohere': return 'cohereApiKey';
  }
}

export function hasApiKey(s: FWSettings): boolean {
  return !!(
    s.anthropicApiKey || s.openaiApiKey || s.deepSeekApiKey || s.geminiApiKey ||
    s.groqApiKey || s.mistralApiKey || s.xaiApiKey || s.openRouterApiKey ||
    s.togetherApiKey || s.cohereApiKey
  );
}

export const SPEED_COLORS: Record<SpeedTier, string> = {
  'ultra-fast': '#4caf50',
  'fast': '#00bcd4',
  'moderate': '#ffab40',
  'slow': '#ef5350',
};

export const SPEED_LABELS: Record<SpeedTier, string> = {
  'ultra-fast': 'Ultra-Fast',
  'fast': 'Fast',
  'moderate': 'Moderate',
  'slow': 'Slow',
};
