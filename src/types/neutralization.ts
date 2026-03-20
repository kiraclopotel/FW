// FeelingWise - Neutralization types

import { AnalysisResult } from './analysis';

export interface NeutralizedContent {
  postId: string;
  originalHash: string;
  rewrittenText: string;
  analysis: AnalysisResult;
  aiSource: 'local' | 'cloud';
  cloudProvider?: string;
  processingTimeMs: number;
}
