// FeelingWise - AI layer types

import { AnalysisResult } from './analysis';

export type CloudProvider = 'gemini' | 'anthropic' | 'openai' | 'deepseek' | 'groq' | 'mistral' | 'xai' | 'openrouter' | 'together' | 'cohere';

export interface AIRequest {
  postText: string;
  analysisResult: AnalysisResult;
  task: 'neutralize' | 'detect-assist' | 'severity-assess';
}

export interface AIResponse {
  text: string;
  source: 'local' | 'cloud';
  provider?: CloudProvider;
  latencyMs: number;
  tokensUsed?: number;
}

export interface RouterDecision {
  useCloud: boolean;
  reason: string;
  confidence: number;
}
