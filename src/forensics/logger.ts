// FeelingWise - Forensic logger
// Creates ForensicRecord for every processed post

import { ForensicRecord } from '../types/forensic';
import { AnalysisResult } from '../types/analysis';
import { Platform } from '../types/post';
import { Mode } from '../types/mode';
import { sha256 } from './hasher';
import { addRecord } from './store';

function modeToAgeCategory(mode: Mode): ForensicRecord['userAgeCategory'] {
  return mode;
}

async function computeIntegrityHash(record: Omit<ForensicRecord, 'integrityHash'>): Promise<string> {
  const payload = JSON.stringify({
    id: record.id,
    timestamp: record.timestamp,
    platform: record.platform,
    originalHash: record.originalHash,
    originalLength: record.originalLength,
    neutralizedText: record.neutralizedText,
    techniques: record.techniques,
    overallScore: record.overallScore,
    userAgeCategory: record.userAgeCategory,
    aiSource: record.aiSource,
  });
  return sha256(payload);
}

export async function logForensicEvent(
  originalText: string,
  neutralizedText: string,
  analysis: AnalysisResult,
  mode: Mode,
  platform: Platform,
  aiSource: 'local' | 'cloud',
): Promise<void> {
  try {
    const originalHash = await sha256(originalText);

    const confirmedTechniques = analysis.techniques
      .filter(t => t.present)
      .map(t => ({ name: t.technique, severity: t.severity, confidence: t.confidence }));

    const partial: Omit<ForensicRecord, 'integrityHash'> = {
      id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      platform,
      originalHash,
      originalLength: originalText.length,
      neutralizedText,
      techniques: confirmedTechniques,
      overallScore: analysis.overallScore,
      userAgeCategory: modeToAgeCategory(mode),
      aiSource,
    };

    console.log(`[FeelingWise] Forensic: logging neutralization for post ${partial.id}`);

    const integrityHash = await computeIntegrityHash(partial);
    const record: ForensicRecord = { ...partial, integrityHash };

    await addRecord(record);
  } catch (err) {
    console.error('[FeelingWise] Forensic logging failed:', err);
  }
}
