// FeelingWise - Analysis result types

export type TechniqueName =
  | 'fear-appeal' | 'anger-trigger' | 'shame-attack' | 'false-urgency'
  | 'bandwagon' | 'scapegoating' | 'fomo' | 'toxic-positivity'
  | 'misleading-format' | 'combined' | 'profanity';

export interface TechniqueResult {
  technique: TechniqueName;
  present: boolean;
  confidence: number;   // 0-1
  severity: number;     // 1-10
  evidence: string[];
}

export interface AnalysisResult {
  postId: string;
  techniques: TechniqueResult[];
  overallScore: number;
  overallConfidence: number;
  isManipulative: boolean;
  processingTimeMs: number;
}
