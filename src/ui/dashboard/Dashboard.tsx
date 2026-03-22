// FeelingWise — Forensic Intelligence Platform
// "Data without relationships is noise. Surface the patterns, not just the events."

import { StrictMode, useState, useEffect, CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { ForensicRecord } from '../../types/forensic';
import { getRecords, getStats, ForensicStats } from '../../forensics/store';
import { exportJSON, exportCSV } from '../../forensics/exporter';
import { verifyBatch, BatchVerificationResult } from '../../forensics/chain-of-custody';
import { getVerdicts, UserVerdict } from '../../forensics/feedback-store';
import { getAllAuthorProfiles, AuthorProfile } from '../../forensics/author-store';

// ─── Design tokens ───
const C = {
  bg: '#0a0a0a',
  card: '#141414',
  cardHover: '#1a1a1a',
  border: '#1e1e1e',
  borderLight: '#2a2a2a',
  text: '#f0f0f0',
  textSecondary: '#ccc',
  muted: '#888',
  teal: '#00bcd4',
  amber: '#ffab40',
  red: '#ef5350',
  green: '#4caf50',
  purple: '#ab47bc',
};

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const TECHNIQUE_COLORS: Record<string, string> = {
  'fear-appeal': '#ef5350',
  'anger-trigger': '#ff7043',
  'shame-attack': '#ab47bc',
  'false-urgency': '#ffab40',
  'bandwagon': '#42a5f5',
  'scapegoating': '#ec407a',
  'fomo': '#ffa726',
  'toxic-positivity': '#66bb6a',
  'misleading-format': '#78909c',
  'combined': '#5c6bc0',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1da1f2',
  facebook: '#4267b2',
  instagram: '#e1306c',
  tiktok: '#69c9d0',
  youtube: '#ff0000',
  reddit: '#ff4500',
  '4chan': '#789922',
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  reddit: 'Reddit',
  '4chan': '4chan',
};

// ─── Helpers ───

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

function techniqueColor(name: string): string {
  return TECHNIQUE_COLORS[name] || C.teal;
}

function platformColor(name: string): string {
  return PLATFORM_COLORS[name] || C.muted;
}

function platformLabel(name: string): string {
  return PLATFORM_LABELS[name] || name;
}

// ─── Main Dashboard ───

function Dashboard() {
  const [records, setRecords] = useState<ForensicRecord[]>([]);
  const [stats, setStats] = useState<ForensicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyResult, setVerifyResult] = useState<BatchVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verdicts, setVerdicts] = useState<UserVerdict[]>([]);
  const [authorProfiles, setAuthorProfiles] = useState<AuthorProfile[]>([]);

  useEffect(() => {
    Promise.all([getRecords(), getStats(), getVerdicts(), getAllAuthorProfiles()])
      .then(([recs, st, vds, authors]) => {
        console.log(`[FeelingWise] Dashboard: loaded ${recs.length} records, ${vds.length} verdicts, ${authors.length} author profiles`);
        setRecords(recs);
        setStats(st);
        setVerdicts(vds);
        setAuthorProfiles(authors);
      })
      .catch(err => { console.error('[FeelingWise] Dashboard: failed to load records:', err); })
      .finally(() => setLoading(false));
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await verifyBatch(records);
      setVerifyResult(result);
    } catch {
      setVerifyResult({ valid: 0, invalid: records.length, details: [] });
    } finally {
      setVerifying(false);
    }
  };

  const page: CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: font,
    fontSize: 14,
  };

  if (loading) {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: C.muted, fontSize: 15 }}>Loading forensic data...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>&#128203;</div>
        <div style={{ color: C.muted, fontSize: 15, textAlign: 'center', maxWidth: 400, lineHeight: '1.6' }}>
          No data yet — neutralized posts will appear here as you browse.
          <br />
          <span style={{ fontSize: 13 }}>
            FeelingWise silently records every manipulation it detects and neutralizes.
          </span>
        </div>
      </div>
    );
  }

  const mostCommonTechnique = stats
    ? Object.entries(stats.byTechnique).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <div style={page}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
            Forensic Intelligence Platform
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
            Patterns, actors, and trends in what the algorithm served — not just events, but intelligence.
          </p>
        </div>

        {/* Section 1: Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <OverviewCard
            label="Posts Scanned Today"
            value={stats?.today ?? 0}
            sub={`${stats?.total ?? 0} all-time`}
            color={C.teal}
          />
          <OverviewCard
            label="Posts Neutralized"
            value={stats?.total ?? 0}
            sub={`${stats?.thisWeek ?? 0} this week`}
            color={C.green}
          />
          <OverviewCard
            label="Most Targeted Technique"
            value={mostCommonTechnique ? mostCommonTechnique[0].replace(/-/g, ' ') : 'none'}
            sub={mostCommonTechnique ? `${mostCommonTechnique[1]} detections` : undefined}
            color={C.amber}
            isText
          />
          <OverviewCard
            label="Techniques Detected"
            value={stats ? Object.keys(stats.byTechnique).length : 0}
            sub={`across ${stats ? Object.keys(stats.byPlatform).length : 0} platforms`}
            color={C.purple}
          />
        </div>

        {/* Section 2: Platform Breakdown */}
        <SectionHeader title="Platform Breakdown" subtitle="What each platform served — per platform accountability" />
        <PlatformBreakdown records={records} stats={stats} />

        {/* Section 3: Technique Frequency */}
        <SectionHeader title="Technique Frequency" subtitle="Manipulation techniques detected, sorted by frequency" />
        <TechniqueChart byTechnique={stats?.byTechnique ?? {}} />

        {/* Section 3b: Algorithm vs Choice */}
        <SectionHeader title="Algorithm vs Choice" subtitle="Where does manipulation come from — the algorithm's recommendations or accounts your child follows?" />
        <AlgorithmVsChoice records={records} />

        {/* Section 4: Time-of-Day Heatmap */}
        <SectionHeader title="Time-of-Day Heatmap" subtitle="When does your child encounter the most manipulation? Hour-by-hour intensity." />
        <TimeOfDayHeatmap records={records} />

        {/* Section 5: Author Repeat Offenders */}
        <SectionHeader title="Repeat Offender Accounts" subtitle="Top accounts responsible for manipulation detections — entity resolution across sessions" />
        <AuthorOffenderTable records={records} authorProfiles={authorProfiles} />

        {/* Section 6: Technique Trend Over Time */}
        <SectionHeader title="Technique Trend Over Time" subtitle="How manipulation techniques shift day-by-day — algorithm behavior changes worth surfacing" />
        <TechniqueTrend records={records} />

        {/* Section 7: Session Intensity */}
        <SectionHeader title="Session Intensity" subtitle="Most intense browsing sessions ranked by manipulation density — high sessions are dangerous" />
        <SessionIntensity records={records} />

        {/* Section 8: Calibration Status */}
        <SectionHeader title="Calibration Status" subtitle="User agreement rate — are detections accurate? Below 70% means over-flagging." />
        <CalibrationStatus verdicts={verdicts} />

        {/* Section 9: Recent Activity Log */}
        <SectionHeader title="Recent Activity" subtitle="Last 50 neutralized posts — click to expand and see before/after" />
        <ActivityLog records={records} />

        {/* Section 10: Export & Evidence */}
        <SectionHeader title="Export &amp; Evidence" subtitle="Download records for research, legal proceedings, or regulatory evidence" />
        <ExportPanel
          records={records}
          verifyResult={verifyResult}
          verifying={verifying}
          onVerify={handleVerify}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Overview Card
// ═══════════════════════════════════════

function OverviewCard({ label, value, sub, color, isText }: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${color}`,
      borderRadius: 8,
      padding: 20,
    }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{
        fontSize: isText ? 16 : 32,
        fontWeight: 600,
        color,
        textTransform: isText ? 'capitalize' : undefined,
        wordBreak: 'break-word',
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════
// Section Header
// ═══════════════════════════════════════

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginTop: 36, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>{subtitle}</p>
    </div>
  );
}

// ═══════════════════════════════════════
// Section 2: Platform Breakdown
// ═══════════════════════════════════════

function PlatformBreakdown({ records, stats }: { records: ForensicRecord[]; stats: ForensicStats | null }) {
  if (!stats || Object.keys(stats.byPlatform).length === 0) {
    return <EmptyCard message="No platform data yet" />;
  }

  const platforms = Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]);

  // Compute per-platform technique and severity
  const platformDetails: Record<string, { count: number; topTechnique: string; avgSeverity: number }> = {};
  for (const [plat] of platforms) {
    const platRecords = records.filter(r => r.platform === plat);
    const techCounts: Record<string, number> = {};
    let totalSeverity = 0;
    for (const r of platRecords) {
      totalSeverity += r.overallScore;
      for (const t of r.techniques) {
        techCounts[t.name] = (techCounts[t.name] || 0) + 1;
      }
    }
    const sorted = Object.entries(techCounts).sort((a, b) => b[1] - a[1]);
    platformDetails[plat] = {
      count: platRecords.length,
      topTechnique: sorted.length > 0 ? sorted[0][0] : 'none',
      avgSeverity: platRecords.length > 0 ? totalSeverity / platRecords.length : 0,
    };
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 8 }}>
      {platforms.map(([plat]) => {
        const d = platformDetails[plat];
        const sevColor = d.avgSeverity >= 7 ? C.red : d.avgSeverity >= 4 ? C.amber : C.green;
        return (
          <div key={plat} style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderLeft: `4px solid ${platformColor(plat)}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: platformColor(plat) }}>
                {platformLabel(plat)}
              </span>
              <span style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                background: platformColor(plat),
                color: '#fff',
                fontWeight: 600,
              }}>
                {d.count} posts
              </span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: C.muted }}>Most common technique: </span>
              <span style={{ color: techniqueColor(d.topTechnique), fontWeight: 500, textTransform: 'capitalize' }}>
                {d.topTechnique.replace(/-/g, ' ')}
              </span>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: C.muted }}>Average severity: </span>
              <span style={{ color: sevColor, fontWeight: 600 }}>{d.avgSeverity.toFixed(1)}</span>
              <span style={{ color: C.muted }}> / 10</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 3: Technique Frequency Chart
// ═══════════════════════════════════════

function TechniqueChart({ byTechnique }: { byTechnique: Record<string, number> }) {
  const sorted = Object.entries(byTechnique).sort((a, b) => b[1] - a[1]);
  const max = sorted.length > 0 ? sorted[0][1] : 1;

  if (sorted.length === 0) {
    return <EmptyCard message="No techniques detected yet" />;
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 8,
    }}>
      {sorted.map(([name, count]) => (
        <div key={name} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>
              {name.replace(/-/g, ' ')}
            </span>
            <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          </div>
          <div style={{ height: 10, background: C.border, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(count / max) * 100}%`,
              background: techniqueColor(name),
              borderRadius: 5,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 3b: Algorithm vs Choice
// ═══════════════════════════════════════

function AlgorithmVsChoice({ records }: { records: ForensicRecord[] }) {
  const forYou = records.filter(r => r.feedSource === 'for-you').length;
  const following = records.filter(r => r.feedSource === 'following').length;
  const other = records.length - forYou - following;
  const total = forYou + following;

  if (total === 0) {
    return <EmptyCard message="No feed source data yet — browse Twitter/X to collect data" />;
  }

  const forYouPct = Math.round((forYou / total) * 100);
  const followingPct = 100 - forYouPct;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 8,
    }}>
      {/* Bar chart */}
      <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        {forYouPct > 0 && (
          <div style={{ width: `${forYouPct}%`, background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{forYouPct}%</span>
          </div>
        )}
        {followingPct > 0 && (
          <div style={{ width: `${followingPct}%`, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{followingPct}%</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: C.red, display: 'inline-block' }} />
          <span style={{ fontSize: 13 }}>For You (algorithm)</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.red }}>{forYou}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: C.green, display: 'inline-block' }} />
          <span style={{ fontSize: 13 }}>Following (choice)</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{following}</span>
        </div>
      </div>

      {/* Insight text */}
      <div style={{
        padding: 14,
        borderRadius: 6,
        background: forYouPct > 50 ? C.red + '15' : C.green + '15',
        border: `1px solid ${forYouPct > 50 ? C.red : C.green}33`,
        fontSize: 13,
        lineHeight: '1.6',
      }}>
        {forYouPct > 50 ? (
          <span style={{ color: C.red }}>
            {forYouPct}% of detected manipulation came from algorithmic recommendations (For You feed).
            The algorithm is actively serving manipulative content — this is not content the user chose to see.
          </span>
        ) : (
          <span style={{ color: C.green }}>
            {followingPct}% of detected manipulation came from accounts being followed.
            Most manipulation comes from accounts the user chose to follow, not algorithmic recommendations.
          </span>
        )}
      </div>

      {other > 0 && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
          {other} post{other !== 1 ? 's' : ''} from other sources (profile, search, unknown) not included in this breakdown.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 4: Time-of-Day Heatmap
// ═══════════════════════════════════════

function TimeOfDayHeatmap({ records }: { records: ForensicRecord[] }) {
  if (records.length === 0) return <EmptyCard message="No data for heatmap yet" />;

  // Group by hour (0-23)
  const hourCounts = new Array(24).fill(0);
  for (const r of records) {
    const hour = new Date(r.timestamp).getHours();
    hourCounts[hour]++;
  }

  const max = Math.max(...hourCounts, 1);

  const hourLabels = Array.from({ length: 24 }, (_, i) => {
    if (i === 0) return '12a';
    if (i < 12) return `${i}a`;
    if (i === 12) return '12p';
    return `${i - 12}p`;
  });

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 80 }}>
        {hourCounts.map((count, i) => {
          const intensity = count / max;
          const bg = count === 0
            ? C.border
            : intensity > 0.7 ? C.red
            : intensity > 0.4 ? C.amber
            : C.teal + '88';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                title={`${hourLabels[i]}: ${count} detections`}
                style={{
                  width: '100%',
                  height: `${Math.max(4, intensity * 60)}px`,
                  background: bg,
                  borderRadius: 2,
                  transition: 'height 0.3s ease',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {hourLabels.map((label, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 9,
            color: C.muted,
            lineHeight: '1.2',
          }}>
            {i % 3 === 0 ? label : ''}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: C.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.teal + '88' }} /> Low
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.amber }} /> Medium
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.red }} /> High
        </span>
        <span style={{ marginLeft: 'auto' }}>
          Peak: <strong style={{ color: C.text }}>{hourLabels[hourCounts.indexOf(max)]}</strong> ({max} detections)
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Section 5: Author Repeat Offender Table
// ═══════════════════════════════════════

interface AuthorSummary {
  author: string;
  totalDetections: number;
  mostCommonTechnique: string;
  avgSeverity: number;
  lastSeen: string;
  flagRate: number | null; // from AuthorProfile if available
}

function AuthorOffenderTable({ records, authorProfiles }: { records: ForensicRecord[]; authorProfiles: AuthorProfile[] }) {
  // Group forensic records by author
  const authorMap: Record<string, { count: number; techniques: Record<string, number>; totalSeverity: number; lastSeen: string }> = {};

  for (const r of records) {
    if (!r.author) continue;
    if (!authorMap[r.author]) {
      authorMap[r.author] = { count: 0, techniques: {}, totalSeverity: 0, lastSeen: r.timestamp };
    }
    const a = authorMap[r.author];
    a.count++;
    a.totalSeverity += r.overallScore;
    if (r.timestamp > a.lastSeen) a.lastSeen = r.timestamp;
    for (const t of r.techniques) {
      a.techniques[t.name] = (a.techniques[t.name] || 0) + 1;
    }
  }

  // Build profile lookup
  const profileMap: Record<string, AuthorProfile> = {};
  for (const p of authorProfiles) {
    profileMap[p.handle] = p;
  }

  const summaries: AuthorSummary[] = Object.entries(authorMap)
    .map(([author, data]) => {
      const techEntries = Object.entries(data.techniques).sort((a, b) => b[1] - a[1]);
      const profile = profileMap[author];
      return {
        author,
        totalDetections: data.count,
        mostCommonTechnique: techEntries.length > 0 ? techEntries[0][0] : 'unknown',
        avgSeverity: data.totalSeverity / data.count,
        lastSeen: data.lastSeen,
        flagRate: profile && profile.totalSeen >= 5 ? profile.totalFlagged / profile.totalSeen : null,
      };
    })
    .sort((a, b) => b.totalDetections - a.totalDetections)
    .slice(0, 10);

  if (summaries.length === 0) return <EmptyCard message="No author data yet" />;

  const totalDetections = records.length;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 140px 80px 90px 70px',
        gap: 8,
        padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 11,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        <span>Author</span>
        <span style={{ textAlign: 'right' }}>Detections</span>
        <span>Top Technique</span>
        <span style={{ textAlign: 'right' }}>Avg Sev.</span>
        <span>Last Seen</span>
        <span style={{ textAlign: 'right' }}>Flag Rate</span>
      </div>

      {summaries.map(s => {
        const pct = ((s.totalDetections / totalDetections) * 100).toFixed(0);
        const sevColor = s.avgSeverity >= 7 ? C.red : s.avgSeverity >= 4 ? C.amber : C.green;
        return (
          <div key={s.author} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 140px 80px 90px 70px',
            gap: 8,
            padding: '10px 16px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: 13,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
              {s.author}
            </span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {s.totalDetections} <span style={{ fontSize: 11, color: C.muted }}>({pct}%)</span>
            </span>
            <span style={{
              fontSize: 11,
              padding: '1px 7px',
              borderRadius: 3,
              background: techniqueColor(s.mostCommonTechnique) + '22',
              color: techniqueColor(s.mostCommonTechnique),
              border: `1px solid ${techniqueColor(s.mostCommonTechnique)}44`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              alignSelf: 'center',
            }}>
              {s.mostCommonTechnique.replace(/-/g, ' ')}
            </span>
            <span style={{ textAlign: 'right', color: sevColor, fontWeight: 600 }}>
              {s.avgSeverity.toFixed(1)}
            </span>
            <span style={{ fontSize: 12, color: C.muted }}>{relativeTime(s.lastSeen)}</span>
            <span style={{ textAlign: 'right', fontSize: 12 }}>
              {s.flagRate !== null ? (
                <span style={{ color: s.flagRate > 0.5 ? C.red : C.muted, fontWeight: s.flagRate > 0.5 ? 600 : 400 }}>
                  {(s.flagRate * 100).toFixed(0)}%
                </span>
              ) : (
                <span style={{ color: C.muted }}>—</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 6: Technique Trend Over Time
// ═══════════════════════════════════════

function TechniqueTrend({ records }: { records: ForensicRecord[] }) {
  if (records.length < 2) return <EmptyCard message="Need at least 2 records to show trends" />;

  // Determine if we should group by day or week
  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const firstDate = new Date(sorted[0].timestamp);
  const lastDate = new Date(sorted[sorted.length - 1].timestamp);
  const daySpan = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const useWeeks = daySpan > 30;

  // Group records by period
  function periodKey(ts: string): string {
    const d = new Date(ts);
    if (useWeeks) {
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return weekStart.toISOString().slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
  }

  // Collect all techniques and periods
  const allTechniques = new Set<string>();
  const periodData: Record<string, Record<string, number>> = {};

  for (const r of sorted) {
    const key = periodKey(r.timestamp);
    if (!periodData[key]) periodData[key] = {};
    for (const t of r.techniques) {
      allTechniques.add(t.name);
      periodData[key][t.name] = (periodData[key][t.name] || 0) + 1;
    }
  }

  const periods = Object.keys(periodData).sort();
  const techniques = Array.from(allTechniques);

  if (periods.length < 2) return <EmptyCard message="Need data from multiple days to show trends" />;

  // Find max value for scaling
  let maxVal = 0;
  for (const period of periods) {
    for (const tech of techniques) {
      maxVal = Math.max(maxVal, periodData[period][tech] || 0);
    }
  }

  const chartHeight = 120;
  const chartWidth = 100; // percentage

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 8,
    }}>
      {/* SVG line chart */}
      <svg
        viewBox={`0 0 ${periods.length * 40} ${chartHeight + 20}`}
        style={{ width: '100%', height: chartHeight + 40 }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <line
            key={frac}
            x1={0}
            y1={chartHeight - frac * chartHeight}
            x2={periods.length * 40}
            y2={chartHeight - frac * chartHeight}
            stroke={C.border}
            strokeWidth={0.5}
          />
        ))}

        {/* Lines per technique */}
        {techniques.map(tech => {
          const points = periods.map((period, i) => {
            const val = periodData[period][tech] || 0;
            const x = i * 40 + 20;
            const y = chartHeight - (val / maxVal) * (chartHeight - 10);
            return `${x},${y}`;
          }).join(' ');

          return (
            <polyline
              key={tech}
              points={points}
              fill="none"
              stroke={techniqueColor(tech)}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          );
        })}

        {/* X-axis labels */}
        {periods.map((period, i) => {
          if (periods.length > 14 && i % Math.ceil(periods.length / 7) !== 0) return null;
          return (
            <text
              key={i}
              x={i * 40 + 20}
              y={chartHeight + 14}
              textAnchor="middle"
              fill={C.muted}
              fontSize={8}
            >
              {period.slice(5)} {/* MM-DD */}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {techniques.map(tech => (
          <span key={tech} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSecondary }}>
            <span style={{ width: 12, height: 3, borderRadius: 1, background: techniqueColor(tech) }} />
            {tech.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
        Grouped by {useWeeks ? 'week' : 'day'} &middot; {daySpan} day span &middot; {periods.length} {useWeeks ? 'weeks' : 'days'} with data
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Section 7: Session Intensity Score
// ═══════════════════════════════════════

interface Session {
  start: string;
  end: string;
  totalPosts: number;
  neutralizedPosts: number;
  intensity: number; // neutralized / total
  techniques: Record<string, number>;
}

function SessionIntensity({ records }: { records: ForensicRecord[] }) {
  if (records.length < 2) return <EmptyCard message="Need more records to detect sessions" />;

  // Sort chronologically
  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Detect sessions: contiguous periods with <5 min gaps
  const GAP_MS = 5 * 60 * 1000;
  const sessions: Session[] = [];
  let sessionRecords: ForensicRecord[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].timestamp).getTime();
    const currTime = new Date(sorted[i].timestamp).getTime();

    if (currTime - prevTime <= GAP_MS) {
      sessionRecords.push(sorted[i]);
    } else {
      // Finalize previous session
      if (sessionRecords.length >= 2) {
        sessions.push(buildSession(sessionRecords));
      }
      sessionRecords = [sorted[i]];
    }
  }
  // Final session
  if (sessionRecords.length >= 2) {
    sessions.push(buildSession(sessionRecords));
  }

  // Sort by intensity descending, take top 5
  const topSessions = sessions
    .sort((a, b) => b.intensity - a.intensity || b.neutralizedPosts - a.neutralizedPosts)
    .slice(0, 5);

  if (topSessions.length === 0) return <EmptyCard message="No browsing sessions detected (need clusters of 2+ events within 5 minutes)" />;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {topSessions.map((s, i) => {
        const intensityColor = s.intensity >= 0.7 ? C.red : s.intensity >= 0.4 ? C.amber : C.green;
        const topTech = Object.entries(s.techniques).sort((a, b) => b[1] - a[1])[0];
        return (
          <div key={i} style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: intensityColor }}>
                  {(s.intensity * 100).toFixed(0)}% manipulation density
                </span>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 12 }}>
                  {new Date(s.start).toLocaleString()} — {new Date(s.end).toLocaleTimeString()}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 4,
                background: intensityColor,
                color: '#fff',
                fontWeight: 600,
              }}>
                #{i + 1}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: C.muted }}>
              <span>{s.neutralizedPosts} neutralized / {s.totalPosts} total posts</span>
              {topTech && (
                <span>
                  Top technique: <span style={{ color: techniqueColor(topTech[0]) }}>{topTech[0].replace(/-/g, ' ')}</span>
                </span>
              )}
              <span>
                Duration: {formatDuration(new Date(s.end).getTime() - new Date(s.start).getTime())}
              </span>
            </div>
            {/* Intensity bar */}
            <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${s.intensity * 100}%`,
                background: intensityColor,
                borderRadius: 2,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildSession(recs: ForensicRecord[]): Session {
  const techniques: Record<string, number> = {};
  for (const r of recs) {
    for (const t of r.techniques) {
      techniques[t.name] = (techniques[t.name] || 0) + 1;
    }
  }
  return {
    start: recs[0].timestamp,
    end: recs[recs.length - 1].timestamp,
    totalPosts: recs.length,
    neutralizedPosts: recs.length, // all forensic records are neutralized posts
    intensity: 1.0, // all logged posts were flagged, so intensity = 1.0 within forensic-only data
    techniques,
  };
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ═══════════════════════════════════════
// Section 8: Calibration Status
// ═══════════════════════════════════════

function CalibrationStatus({ verdicts }: { verdicts: UserVerdict[] }) {
  if (verdicts.length === 0) {
    return (
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 24,
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>
          No user feedback yet. When users click "Got it" (teen mode) or "Dismiss" (adult mode),
          their verdicts are recorded here to calibrate detection accuracy.
        </div>
      </div>
    );
  }

  const confirmed = verdicts.filter(v => v.verdict === 'confirmed').length;
  const disputed = verdicts.filter(v => v.verdict === 'disputed').length;
  const total = verdicts.length;
  const agreementRate = confirmed / total;
  const rateColor = agreementRate >= 0.7 ? C.green : agreementRate >= 0.5 ? C.amber : C.red;

  // Breakdown by mode
  const byMode: Record<string, { confirmed: number; disputed: number }> = {};
  for (const v of verdicts) {
    if (!byMode[v.mode]) byMode[v.mode] = { confirmed: 0, disputed: 0 };
    byMode[v.mode][v.verdict]++;
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 40, fontWeight: 600, color: rateColor }}>
            {(agreementRate * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>User agreement rate</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, background: C.border, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%',
              width: `${agreementRate * 100}%`,
              background: rateColor,
              borderRadius: 6,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}>
            <span>{confirmed} confirmed</span>
            <span>{disputed} disputed</span>
            <span>{total} total verdicts</span>
          </div>
        </div>
      </div>

      {/* Per-mode breakdown */}
      {Object.entries(byMode).length > 1 && (
        <div style={{ display: 'flex', gap: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          {Object.entries(byMode).map(([mode, data]) => {
            const modeRate = data.confirmed / (data.confirmed + data.disputed);
            return (
              <div key={mode} style={{ fontSize: 12, color: C.muted }}>
                <span style={{ textTransform: 'capitalize', fontWeight: 500, color: C.textSecondary }}>{mode}</span>:{' '}
                <span style={{ color: modeRate >= 0.7 ? C.green : C.amber }}>{(modeRate * 100).toFixed(0)}%</span>
                {' '}({data.confirmed + data.disputed} verdicts)
              </div>
            );
          })}
        </div>
      )}

      {agreementRate < 0.7 && (
        <div style={{
          marginTop: 12,
          padding: '10px 14px',
          background: C.red + '12',
          border: `1px solid ${C.red}33`,
          borderRadius: 6,
          fontSize: 12,
          color: C.red,
        }}>
          Agreement rate is below 70%. The system may be over-flagging content.
          Consider reviewing recent disputed detections to identify false positive patterns.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 9: Activity Log
// ═══════════════════════════════════════

function ActivityLog({ records }: { records: ForensicRecord[] }) {
  const recent = [...records]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (recent.length === 0) {
    return <EmptyCard message="No activity yet" />;
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8,
      maxHeight: 700,
      overflowY: 'auto',
    }}>
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 100px 1fr 130px 50px',
        gap: 8,
        padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 11,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        position: 'sticky',
        top: 0,
        background: C.card,
        zIndex: 1,
      }}>
        <span>Time</span>
        <span>Platform</span>
        <span>Techniques</span>
        <span>Author</span>
        <span style={{ textAlign: 'right' }}>Score</span>
      </div>

      {recent.map(r => {
        const expanded = expandedId === r.id;
        return (
          <div key={r.id}>
            {/* Row */}
            <div
              onClick={() => setExpandedId(expanded ? null : r.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 100px 1fr 130px 50px',
                gap: 8,
                padding: '10px 16px',
                borderBottom: `1px solid ${C.border}`,
                cursor: 'pointer',
                background: expanded ? C.cardHover : 'transparent',
              }}
            >
              <span style={{ fontSize: 12, color: C.muted }}>{relativeTime(r.timestamp)}</span>
              <span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: platformColor(r.platform),
                  color: '#fff',
                  fontWeight: 500,
                }}>
                  {r.platform}
                </span>
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {r.techniques.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 11,
                    padding: '1px 7px',
                    borderRadius: 3,
                    background: techniqueColor(t.name) + '22',
                    color: techniqueColor(t.name),
                    border: `1px solid ${techniqueColor(t.name)}44`,
                    whiteSpace: 'nowrap',
                  }}>
                    {t.name.replace(/-/g, ' ')}
                  </span>
                ))}
              </span>
              <span style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.author || '—'}
              </span>
              <span style={{ textAlign: 'right' }}>
                <SeverityBadge score={r.overallScore} />
              </span>
            </div>

            {/* Expanded detail */}
            {expanded && (
              <div style={{
                padding: '16px 20px',
                background: '#0e0e0e',
                borderBottom: `1px solid ${C.border}`,
              }}>
                {/* Before / After comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.red, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
                      What the platform served
                    </div>
                    <div style={{
                      padding: 12,
                      background: C.card,
                      border: `1px solid ${C.red}33`,
                      borderRadius: 6,
                      fontSize: 13,
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: C.textSecondary,
                    }}>
                      {r.originalText || <span style={{ color: C.muted, fontStyle: 'italic' }}>Original text not available (recorded before v0.2)</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.green, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
                      What your child saw instead
                    </div>
                    <div style={{
                      padding: 12,
                      background: C.card,
                      border: `1px solid ${C.green}33`,
                      borderRadius: 6,
                      fontSize: 13,
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: C.textSecondary,
                    }}>
                      {r.neutralizedText}
                    </div>
                  </div>
                </div>

                {/* Technique detail pills */}
                {r.techniques.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Techniques detected:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.techniques.map((t, i) => (
                        <span key={i} style={{
                          fontSize: 11,
                          padding: '3px 10px',
                          borderRadius: 4,
                          background: techniqueColor(t.name),
                          color: '#fff',
                          fontWeight: 500,
                        }}>
                          {t.name.replace(/-/g, ' ')} &middot; severity {t.severity} &middot; {(t.confidence * 100).toFixed(0)}% conf
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11, color: C.muted }}>
                  <span>Platform: <strong style={{ color: C.textSecondary }}>{platformLabel(r.platform)}</strong></span>
                  {r.author && <span>Author: <strong style={{ color: C.textSecondary }}>{r.author}</strong></span>}
                  <span>AI: <strong style={{ color: C.textSecondary }}>{r.aiSource}</strong></span>
                  <span>Age mode: <strong style={{ color: C.textSecondary }}>{r.userAgeCategory}</strong></span>
                  <span>Length: <strong style={{ color: C.textSecondary }}>{r.originalLength} chars</strong></span>
                  <span>Time: <strong style={{ color: C.textSecondary }}>{new Date(r.timestamp).toLocaleString()}</strong></span>
                </div>

                {/* Integrity info */}
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>
                  Record ID: {r.id} &middot; Hash: {r.originalHash.slice(0, 16)}... &middot; Integrity: {r.integrityHash.slice(0, 16)}...
                </div>

                {/* Post URL link */}
                {r.postUrl && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={r.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: C.teal, textDecoration: 'underline' }}
                    >
                      View original post
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 5: Export & Evidence
// ═══════════════════════════════════════

function ExportPanel({ records, verifyResult, verifying, onVerify }: {
  records: ForensicRecord[];
  verifyResult: BatchVerificationResult | null;
  verifying: boolean;
  onVerify: () => void;
}) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 32,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <ActionButton label="Export Full Report (JSON)" onClick={() => exportJSON(records)} />
        <ActionButton label="Export Summary (CSV)" onClick={() => exportCSV(records)} />
        <ActionButton
          label={verifying ? 'Verifying...' : 'Verify Data Integrity'}
          onClick={onVerify}
          disabled={verifying}
          accent
        />
      </div>

      {/* Verification result */}
      {verifyResult && (
        <div style={{
          padding: 14,
          borderRadius: 6,
          background: verifyResult.invalid === 0 ? C.green + '15' : C.red + '15',
          border: `1px solid ${verifyResult.invalid === 0 ? C.green : C.red}33`,
          marginBottom: 16,
          fontSize: 13,
        }}>
          {verifyResult.invalid === 0 ? (
            <span style={{ color: C.green }}>
              All {verifyResult.valid} records passed integrity verification. No tampering detected.
            </span>
          ) : (
            <span style={{ color: C.red }}>
              {verifyResult.invalid} of {verifyResult.valid + verifyResult.invalid} records failed verification.
              These records may have been modified outside FeelingWise.
            </span>
          )}
        </div>
      )}

      <div style={{
        fontSize: 12,
        color: C.muted,
        lineHeight: '1.6',
        borderTop: `1px solid ${C.border}`,
        paddingTop: 16,
      }}>
        All records are cryptographically hashed at time of capture using SHA-256.
        Each record includes a chain-of-custody integrity hash that can be independently verified.
        This data is suitable for research, legal proceedings, and regulatory evidence.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Shared small components
// ═══════════════════════════════════════

function SeverityBadge({ score }: { score: number }) {
  const color = score >= 7 ? C.red : score >= 4 ? C.amber : C.green;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: 4,
      background: color,
      color: '#fff',
      minWidth: 28,
      textAlign: 'center',
    }}>
      {score.toFixed(1)}
    </span>
  );
}

function ActionButton({ label, onClick, disabled, accent }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 20px',
        fontSize: 13,
        fontWeight: 500,
        background: accent ? C.teal + '18' : C.bg,
        color: accent ? C.teal : C.text,
        border: `1px solid ${accent ? C.teal + '55' : C.border}`,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: font,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 32,
      textAlign: 'center',
      color: C.muted,
      fontSize: 13,
      marginBottom: 8,
    }}>
      {message}
    </div>
  );
}

// ─── Mount ───
createRoot(document.getElementById('root')!).render(
  <StrictMode><Dashboard /></StrictMode>
);
export default Dashboard;
