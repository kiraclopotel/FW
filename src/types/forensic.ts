// FeelingWise - Forensic record types

import { Platform } from './post';

export interface ForensicRecord {
  id: string;
  timestamp: string;
  platform: Platform;
  originalText: string;
  originalHash: string;
  originalLength: number;
  neutralizedText: string;
  author: string;
  postUrl: string;
  techniques: { name: string; severity: number; confidence: number }[];
  overallScore: number;
  userAgeCategory: 'child' | 'teen' | 'adult';
  aiSource: 'local' | 'cloud';
  integrityHash: string;
}
