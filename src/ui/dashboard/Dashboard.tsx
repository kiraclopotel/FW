// FeelingWise — Forensic Evidence Dashboard
// "The parent sees exactly what the platform's algorithm served their child."

import { StrictMode, useState, useEffect, CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { ForensicRecord } from '../../types/forensic';
import { getRecords, getStats, ForensicStats } from '../../forensics/store';
import { exportJSON, exportCSV } from '../../forensics/exporter';
import { verifyBatch, BatchVerificationResult } from '../../forensics/chain-of-custody';

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
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
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

  useEffect(() => {
    Promise.all([getRecords(), getStats()])
      .then(([recs, st]) => {
        console.log(`[FeelingWise] Dashboard: loaded ${recs.length} records`);
        setRecords(recs);
        setStats(st);
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
            Forensic Evidence Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
            A complete record of what the platform's algorithm served your child — and what FeelingWise did about it.
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

        {/* Section 4: Recent Activity Log */}
        <SectionHeader title="Recent Activity" subtitle="Last 50 neutralized posts — click to expand and see before/after" />
        <ActivityLog records={records} />

        {/* Section 5: Export & Evidence */}
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
// Section 4: Activity Log
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
