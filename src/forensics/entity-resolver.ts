// FeelingWise - Cross-platform entity resolution
// Links the same actor across platforms using browser-observable signals.
//
// HIGH-CONFIDENCE signals (implemented):
//   - Exact handle match (same username on Twitter + Reddit + YouTube)
//   - Normalized handle match (underscores, dashes, dots stripped)
//
// FUTURE signals (not implemented yet, noted as TODO):
//   - Bio link cross-references
//   - Content similarity across platforms
//   - Temporal posting patterns
//
// This is deliberately conservative. A false merge (linking two different people)
// is worse than a missed merge (not linking the same person).

import { AuthorProfile, getAllAuthorProfiles } from './author-store';

export interface ResolvedEntity {
  primaryHandle: string;
  profiles: AuthorProfile[];  // All linked profiles
  platforms: string[];
  totalSeen: number;
  totalFlagged: number;
  flagRate: number;
  techniques: Record<string, number>;
  confidence: 'exact' | 'normalized' | 'probable';
}

function normalizeHandle(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/^[@\/]/, '')   // strip leading @ or /
    .replace(/[._-]/g, '')   // strip dots, underscores, dashes
    .trim();
}

/**
 * Resolve entities across all known author profiles.
 * Groups profiles that likely belong to the same person.
 */
export async function resolveEntities(): Promise<ResolvedEntity[]> {
  const profiles = await getAllAuthorProfiles();
  if (profiles.length === 0) return [];

  // Group by normalized handle
  const groups: Record<string, AuthorProfile[]> = {};

  for (const profile of profiles) {
    const normalized = normalizeHandle(profile.handle);
    if (!normalized) continue;
    if (!groups[normalized]) groups[normalized] = [];
    groups[normalized].push(profile);
  }

  // Build resolved entities from groups with 2+ profiles (cross-platform)
  const entities: ResolvedEntity[] = [];

  for (const [normalizedKey, groupProfiles] of Object.entries(groups)) {
    // Check if profiles span multiple platforms
    const platforms = [...new Set(groupProfiles.map(p => p.platform))];
    if (platforms.length < 2) continue; // Same platform = not cross-platform

    // Determine confidence
    const handles = groupProfiles.map(p => p.handle.toLowerCase().replace(/^[@\/]/, ''));
    const allExact = handles.every(h => h === handles[0]);
    const confidence = allExact ? 'exact' as const : 'normalized' as const;

    // Aggregate stats
    const totalSeen = groupProfiles.reduce((s, p) => s + p.totalSeen, 0);
    const totalFlagged = groupProfiles.reduce((s, p) => s + p.totalFlagged, 0);

    const techniques: Record<string, number> = {};
    for (const p of groupProfiles) {
      for (const [tech, count] of Object.entries(p.techniques)) {
        techniques[tech] = (techniques[tech] || 0) + count;
      }
    }

    entities.push({
      primaryHandle: groupProfiles.sort((a, b) => b.totalSeen - a.totalSeen)[0].handle,
      profiles: groupProfiles,
      platforms,
      totalSeen,
      totalFlagged,
      flagRate: totalSeen > 0 ? totalFlagged / totalSeen : 0,
      techniques,
      confidence,
    });
  }

  // Sort by flag rate descending
  return entities.sort((a, b) => b.flagRate - a.flagRate);
}
