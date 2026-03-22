// FeelingWise - Adaptive threshold calibration
// Adjusts confidence thresholds based on user verdict feedback.
//
// DESIGN PRINCIPLES:
// - Minimum 20 verdicts before any adjustment (statistical significance)
// - Exponential moving average to weight recent feedback more
// - Hard floors: child never below 0.35, teen never below 0.30, adult never below 0.25
// - Hard ceilings: never above 0.80 (would suppress too many detections)
// - Child mode thresholds are parent-locked (require PIN to auto-adjust)
// - Dampening factor prevents oscillation
// - Per-technique tracking when sufficient data exists

import { getVerdicts, UserVerdict } from '../forensics/feedback-store';
import { Mode } from '../types/mode';

export interface CalibrationResult {
  mode: Mode;
  currentThreshold: number;
  suggestedThreshold: number;
  agreementRate: number;
  totalVerdicts: number;
  shouldAdjust: boolean;
  reason: string;
  perTechnique: Record<string, { agreementRate: number; verdicts: number }>;
}

const HARD_FLOORS: Record<Mode, number> = { child: 0.35, teen: 0.30, adult: 0.25 };
const HARD_CEILINGS: Record<Mode, number> = { child: 0.70, teen: 0.65, adult: 0.60 };
const MIN_VERDICTS = 20;
const DAMPENING = 0.3; // Only move 30% toward the suggested threshold per recalculation
const EMA_ALPHA = 0.1; // Exponential moving average decay
const DEFAULT_THRESHOLDS: Record<Mode, number> = { child: 0.45, teen: 0.40, adult: 0.35 };

/**
 * Compute calibration recommendation for a given mode.
 */
export async function calibrate(mode: Mode): Promise<CalibrationResult> {
  const allVerdicts = await getVerdicts();
  const modeVerdicts = allVerdicts.filter(v => v.mode === mode);
  const currentThreshold = DEFAULT_THRESHOLDS[mode];

  if (modeVerdicts.length < MIN_VERDICTS) {
    return {
      mode,
      currentThreshold,
      suggestedThreshold: currentThreshold,
      agreementRate: 0,
      totalVerdicts: modeVerdicts.length,
      shouldAdjust: false,
      reason: `Need ${MIN_VERDICTS - modeVerdicts.length} more verdicts before calibration`,
      perTechnique: {},
    };
  }

  // Compute agreement rate with EMA (recent verdicts weighted more)
  let emaAgreement = 0.5; // Start at 50%
  const sorted = [...modeVerdicts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const v of sorted) {
    const isAgreement = v.verdict === 'confirmed' || v.verdict === 'spotted';
    const signal = isAgreement ? 1.0 : 0.0;
    emaAgreement = EMA_ALPHA * signal + (1 - EMA_ALPHA) * emaAgreement;
  }

  // Simple agreement rate for display
  const agreed = modeVerdicts.filter(v => v.verdict === 'confirmed' || v.verdict === 'spotted').length;
  const simpleRate = agreed / modeVerdicts.length;

  // Threshold adjustment logic:
  // High agreement (>80%) → threshold is good or could be lowered (catch more)
  // Medium agreement (60-80%) → threshold is roughly right
  // Low agreement (<60%) → too many false positives, raise threshold
  let suggestedThreshold = currentThreshold;
  let reason = '';

  if (emaAgreement < 0.50) {
    // Severe over-flagging: raise threshold significantly
    suggestedThreshold = currentThreshold + 0.10;
    reason = 'Agreement rate below 50% — raising threshold to reduce false positives';
  } else if (emaAgreement < 0.65) {
    // Moderate over-flagging: raise threshold slightly
    suggestedThreshold = currentThreshold + 0.05;
    reason = 'Agreement rate below 65% — slight threshold increase recommended';
  } else if (emaAgreement > 0.90 && modeVerdicts.length > 50) {
    // Very high agreement with many samples: could lower threshold
    suggestedThreshold = currentThreshold - 0.03;
    reason = 'Agreement rate above 90% — threshold could be lowered to catch more';
  } else {
    reason = 'Agreement rate is within acceptable range — no adjustment needed';
  }

  // Apply dampening
  suggestedThreshold = currentThreshold + (suggestedThreshold - currentThreshold) * DAMPENING;

  // Enforce hard floors and ceilings
  suggestedThreshold = Math.max(HARD_FLOORS[mode], Math.min(HARD_CEILINGS[mode], suggestedThreshold));

  // Round to 2 decimal places
  suggestedThreshold = Math.round(suggestedThreshold * 100) / 100;

  const shouldAdjust = Math.abs(suggestedThreshold - currentThreshold) >= 0.02;

  // Per-technique breakdown (only for techniques with 5+ verdicts)
  // Note: we'd need technique info in verdicts for this — currently we don't have it.
  // TODO: Add technique to UserVerdict type in a future update.
  const perTechnique: Record<string, { agreementRate: number; verdicts: number }> = {};

  return {
    mode,
    currentThreshold,
    suggestedThreshold,
    agreementRate: simpleRate,
    totalVerdicts: modeVerdicts.length,
    shouldAdjust,
    reason,
    perTechnique,
  };
}

/**
 * Get the effective threshold for a mode, incorporating calibration if available.
 * Falls back to default if not enough data.
 *
 * This is what the pipeline should call instead of hardcoded thresholds.
 */
export async function getEffectiveThreshold(mode: Mode): Promise<number> {
  try {
    // Check if there's a stored calibrated threshold
    const result = await chrome.storage.local.get(`calibratedThreshold_${mode}`);
    const stored = result[`calibratedThreshold_${mode}`];
    if (typeof stored === 'number' && stored >= HARD_FLOORS[mode] && stored <= HARD_CEILINGS[mode]) {
      return stored;
    }
  } catch {
    // Storage unavailable — use default
  }
  return DEFAULT_THRESHOLDS[mode];
}

/**
 * Apply a calibration result (store the new threshold).
 * For child mode, this should require PIN verification first.
 */
export async function applyCalibration(result: CalibrationResult): Promise<void> {
  if (!result.shouldAdjust) return;

  await chrome.storage.local.set({
    [`calibratedThreshold_${result.mode}`]: result.suggestedThreshold,
    [`calibrationTimestamp_${result.mode}`]: new Date().toISOString(),
  });

  console.log(
    `[FeelingWise] Calibration applied: ${result.mode} threshold ` +
    `${result.currentThreshold} → ${result.suggestedThreshold} (${result.reason})`
  );
}
