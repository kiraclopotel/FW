// FeelingWise - Mode system types

export type Mode = 'child' | 'teen' | 'adult';
export type AutonomyLevel = 1 | 2 | 3 | 4;

export interface ModeConfig {
  mode: Mode;
  autoNeutralizeThreshold: number;
  showBadge: boolean;
  showAnalysis: boolean;
  showOriginalToggle: boolean;
  enableLearningZone: boolean;
  enableDashboard: boolean;
  enableScamDetection: boolean;
  autonomyLevel?: AutonomyLevel;
}

export interface UserProfile {
  mode: Mode;
  autonomyLevel: AutonomyLevel;
  parentPinHash?: string;
  setupDate: string;
  lastActive: string;
}
