// FeelingWise - Temporal anomaly detection
// Detects unusual spikes in manipulation density using scan event data.
// Uses a rolling baseline with day-of-week adjustment.

import { ScanEvent, getScanEvents } from './scan-log';

export interface AnomalyAlert {
  type: 'daily-spike' | 'hourly-spike' | 'technique-spike' | 'platform-spike';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric: string;
  observed: number;
  baseline: number;
  ratio: number;  // observed / baseline
  timestamp: string;
}

interface DailyBucket {
  date: string;
  dayOfWeek: number; // 0=Sunday
  scanned: number;
  flagged: number;
  rate: number;
  byTechnique: Record<string, number>;
  byPlatform: Record<string, number>;
}

function bucketByDay(events: ScanEvent[]): DailyBucket[] {
  const buckets: Record<string, DailyBucket> = {};

  for (const e of events) {
    const date = e.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!buckets[date]) {
      const d = new Date(date);
      buckets[date] = {
        date,
        dayOfWeek: d.getDay(),
        scanned: 0,
        flagged: 0,
        rate: 0,
        byTechnique: {},
        byPlatform: {},
      };
    }
    const b = buckets[date];
    b.scanned++;
    if (e.action !== 'pass') {
      b.flagged++;
    }
    b.byPlatform[e.platform] = (b.byPlatform[e.platform] || 0) + 1;
  }

  // Compute rates
  for (const b of Object.values(buckets)) {
    b.rate = b.scanned > 0 ? b.flagged / b.scanned : 0;
  }

  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Compute rolling baseline: average of the same day-of-week over the past N weeks.
 * Falls back to overall average if not enough same-day data.
 */
function computeBaseline(
  buckets: DailyBucket[],
  targetDayOfWeek: number,
  metric: (b: DailyBucket) => number,
  minSamples = 3,
): number {
  // Same day-of-week in history
  const sameDayBuckets = buckets.filter(b => b.dayOfWeek === targetDayOfWeek);
  if (sameDayBuckets.length >= minSamples) {
    const values = sameDayBuckets.map(metric);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Fallback: overall average (excluding the most recent day)
  if (buckets.length < 2) return 0;
  const historical = buckets.slice(0, -1);
  const values = historical.map(metric);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Detect anomalies in the most recent day compared to historical baseline.
 */
export async function detectAnomalies(): Promise<AnomalyAlert[]> {
  // Load 30 days of scan data
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const events = await getScanEvents(cutoff);

  if (events.length < 50) return []; // Not enough data for meaningful baselines

  const buckets = bucketByDay(events);
  if (buckets.length < 3) return []; // Need at least 3 days

  const today = buckets[buckets.length - 1];
  const historical = buckets.slice(0, -1);
  const alerts: AnomalyAlert[] = [];

  // 1. Daily manipulation rate spike
  const baselineRate = computeBaseline(historical, today.dayOfWeek, b => b.rate);
  if (baselineRate > 0 && today.rate > 0) {
    const ratio = today.rate / baselineRate;
    if (ratio >= 3.0) {
      alerts.push({
        type: 'daily-spike',
        severity: 'critical',
        message: `Manipulation rate is ${ratio.toFixed(1)}x the normal ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.dayOfWeek]} average`,
        metric: 'manipulation_rate',
        observed: today.rate,
        baseline: baselineRate,
        ratio,
        timestamp: today.date,
      });
    } else if (ratio >= 2.0) {
      alerts.push({
        type: 'daily-spike',
        severity: 'warning',
        message: `Manipulation rate is ${ratio.toFixed(1)}x above normal for ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.dayOfWeek]}`,
        metric: 'manipulation_rate',
        observed: today.rate,
        baseline: baselineRate,
        ratio,
        timestamp: today.date,
      });
    }
  }

  // 2. Volume spike (child browsed much more than usual)
  const baselineScanned = computeBaseline(historical, today.dayOfWeek, b => b.scanned);
  if (baselineScanned > 10 && today.scanned > 0) {
    const volumeRatio = today.scanned / baselineScanned;
    if (volumeRatio >= 3.0) {
      alerts.push({
        type: 'daily-spike',
        severity: 'warning',
        message: `Browsing volume is ${volumeRatio.toFixed(1)}x higher than usual (${today.scanned} posts vs typical ${Math.round(baselineScanned)})`,
        metric: 'scan_volume',
        observed: today.scanned,
        baseline: baselineScanned,
        ratio: volumeRatio,
        timestamp: today.date,
      });
    }
  }

  // 3. Platform spike (suddenly using a new platform much more)
  for (const [platform, count] of Object.entries(today.byPlatform)) {
    const baselinePlatform = computeBaseline(
      historical,
      today.dayOfWeek,
      b => b.byPlatform[platform] || 0,
      2,
    );
    if (baselinePlatform > 5 && count > 0) {
      const platformRatio = count / baselinePlatform;
      if (platformRatio >= 3.0) {
        alerts.push({
          type: 'platform-spike',
          severity: 'info',
          message: `${platform} usage is ${platformRatio.toFixed(1)}x higher than normal (${count} vs typical ${Math.round(baselinePlatform)})`,
          metric: `platform_${platform}`,
          observed: count,
          baseline: baselinePlatform,
          ratio: platformRatio,
          timestamp: today.date,
        });
      }
    }
  }

  return alerts;
}
