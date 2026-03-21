// FeelingWise - Chain of custody verification
// Validates exported records match stored hashes

import { ForensicRecord } from '../types/forensic';
import { sha256 } from './hasher';

async function computeIntegrityHash(record: ForensicRecord): Promise<string> {
  const payload = JSON.stringify({
    id: record.id,
    timestamp: record.timestamp,
    platform: record.platform,
    originalText: record.originalText,
    originalHash: record.originalHash,
    originalLength: record.originalLength,
    neutralizedText: record.neutralizedText,
    author: record.author,
    postUrl: record.postUrl,
    techniques: record.techniques,
    overallScore: record.overallScore,
    userAgeCategory: record.userAgeCategory,
    aiSource: record.aiSource,
  });
  return sha256(payload);
}

export async function verifyRecord(record: ForensicRecord): Promise<boolean> {
  const expected = await computeIntegrityHash(record);
  return expected === record.integrityHash;
}

export interface BatchVerificationResult {
  valid: number;
  invalid: number;
  details: { id: string; valid: boolean }[];
}

export async function verifyBatch(records: ForensicRecord[]): Promise<BatchVerificationResult> {
  const result: BatchVerificationResult = { valid: 0, invalid: 0, details: [] };

  for (const record of records) {
    const isValid = await verifyRecord(record);
    if (isValid) {
      result.valid++;
    } else {
      result.invalid++;
    }
    result.details.push({ id: record.id, valid: isValid });
  }

  return result;
}
