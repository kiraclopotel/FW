// FeelingWise - Campaign detection via trigram similarity clustering
// Identifies coordinated manipulation campaigns — groups of similar posts using the same techniques.

import { ForensicRecord } from '../types/forensic';

export interface Campaign {
  id: string;
  records: ForensicRecord[];
  sharedTechniques: string[];
  similarity: number;
  firstSeen: string;
  lastSeen: string;
  platforms: string[];
}

export function textFingerprint(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .trim();
  const trigrams = new Set<string>();
  for (let i = 0; i <= cleaned.length - 3; i++) {
    trigrams.add(cleaned.slice(i, i + 3));
  }
  return trigrams;
}

export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function detectCampaigns(records: ForensicRecord[]): Campaign[] {
  // Filter to last 24 hours
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = records.filter(r => new Date(r.timestamp).getTime() > cutoff);

  // Precompute fingerprints and technique sets
  const fingerprints = recent.map(r => textFingerprint(r.originalText));
  const techniqueSets = recent.map(r => new Set(r.techniques.map(t => t.name)));

  // Greedy clustering
  const clustered = new Set<number>();
  const clusters: { indices: number[]; avgSim: number }[] = [];

  for (let i = 0; i < recent.length; i++) {
    if (clustered.has(i)) continue;
    const cluster = [i];
    for (let j = i + 1; j < recent.length; j++) {
      if (clustered.has(j)) continue;
      const sim = similarity(fingerprints[i], fingerprints[j]);
      if (sim <= 0.6) continue;
      // Check shared techniques
      const shared = [...techniqueSets[i]].filter(t => techniqueSets[j].has(t));
      if (shared.length === 0) continue;
      cluster.push(j);
    }
    if (cluster.length >= 3) {
      // Compute average similarity within cluster
      let totalSim = 0;
      let pairs = 0;
      for (let a = 0; a < cluster.length; a++) {
        for (let b = a + 1; b < cluster.length; b++) {
          totalSim += similarity(fingerprints[cluster[a]], fingerprints[cluster[b]]);
          pairs++;
        }
      }
      clusters.push({ indices: cluster, avgSim: pairs > 0 ? totalSim / pairs : 0 });
      cluster.forEach(idx => clustered.add(idx));
    }
  }

  return clusters.map((c, i) => {
    const clusterRecords = c.indices.map(idx => recent[idx]);
    const allTechniques = clusterRecords.flatMap(r => r.techniques.map(t => t.name));
    const techniqueCounts: Record<string, number> = {};
    allTechniques.forEach(t => { techniqueCounts[t] = (techniqueCounts[t] || 0) + 1; });
    const sharedTechniques = Object.entries(techniqueCounts)
      .filter(([, count]) => count >= 2)
      .map(([name]) => name);
    const timestamps = clusterRecords.map(r => r.timestamp).sort();
    const platforms = [...new Set(clusterRecords.map(r => r.platform))];

    return {
      id: `campaign-${i + 1}`,
      records: clusterRecords,
      sharedTechniques,
      similarity: c.avgSim,
      firstSeen: timestamps[0],
      lastSeen: timestamps[timestamps.length - 1],
      platforms,
    };
  });
}
