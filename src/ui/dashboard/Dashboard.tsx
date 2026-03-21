import { StrictMode, useState, useEffect, CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { ForensicRecord } from '../../types/forensic';
import { getRecords, getStats, ForensicStats } from '../../forensics/store';
import { exportJSON, exportCSV } from '../../forensics/exporter';

// ─── Color palette (matches Popup.tsx) ───
const C = {
  bg: '#0a0a0a',
  card: '#141414',
  border: '#1e1e1e',
  text: '#f0f0f0',
  muted: '#888',
  teal: '#00bcd4',
  amber: '#ffab40',
  red: '#ef5350',
  green: '#4caf50',
};

const font = 'system-ui, -apple-system, sans-serif';

// ─── Technique colors ───
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

// ─── Platform colors ───
const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1da1f2',
  facebook: '#4267b2',
  instagram: '#e1306c',
  tiktok: '#69c9d0',
  youtube: '#ff0000',
};

function Dashboard() {
  const [records, setRecords] = useState<ForensicRecord[]>([]);
  const [stats, setStats] = useState<ForensicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRecords(), getStats()])
      .then(([recs, st]) => { setRecords(recs); setStats(st); })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, []);

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: font,
    fontSize: 14,
    padding: '24px 32px',
    boxSizing: 'border-box',
  };

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: C.muted }}>Loading forensic data...</span>
      </div>
    );
  }

  const mostCommonTechnique = stats
    ? Object.entries(stats.byTechnique).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>FeelingWise Forensic Dashboard</h1>
          <span style={{ fontSize: 12, color: C.muted }}>
            {records.length} records in database
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton label="Export JSON" onClick={() => exportJSON(records)} />
          <ExportButton label="Export CSV" onClick={() => exportCSV(records)} />
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <SummaryCard label="Total Analyzed" value={stats.total} color={C.teal} />
          <SummaryCard label="Neutralizations" value={stats.total} color={C.green} />
          <SummaryCard
            label="Top Technique"
            value={mostCommonTechnique ? mostCommonTechnique[0] : '—'}
            sub={mostCommonTechnique ? `${mostCommonTechnique[1]} detections` : undefined}
            color={C.amber}
          />
          <SummaryCard label="Today" value={stats.today} color={C.teal} />
        </div>
      )}

      {/* Middle row: Technique Breakdown + Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {stats && <TechniqueBreakdown byTechnique={stats.byTechnique} />}
        <Timeline records={records} />
      </div>

      {/* Platform Comparison */}
      {stats && Object.keys(stats.byPlatform).length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <PlatformComparison byPlatform={stats.byPlatform} />
        </div>
      )}

      {/* Recent Activity */}
      <RecentActivity records={records} />
    </div>
  );
}

// ─── Summary Card ───
function SummaryCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 20,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontSize: typeof value === 'number' ? 32 : 16,
        fontWeight: 600,
        color,
        wordBreak: 'break-word',
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Technique Breakdown ───
function TechniqueBreakdown({ byTechnique }: { byTechnique: Record<string, number> }) {
  const sorted = Object.entries(byTechnique).sort((a, b) => b[1] - a[1]);
  const max = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 20,
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 500 }}>Technique Breakdown</h3>
      {sorted.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No data yet</div>}
      {sorted.map(([name, count]) => (
        <div key={name} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span>{name}</span>
            <span style={{ color: C.muted }}>{count}</span>
          </div>
          <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(count / max) * 100}%`,
              background: TECHNIQUE_COLORS[name] || C.teal,
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Timeline (last 30 days) ───
function Timeline({ records }: { records: ForensicRecord[] }) {
  const now = new Date();
  const days: { label: string; dateKey: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    days.push({ label, dateKey });
  }

  const countsByDay: Record<string, number> = {};
  for (const r of records) {
    const key = r.timestamp.slice(0, 10);
    countsByDay[key] = (countsByDay[key] || 0) + 1;
  }

  const maxCount = Math.max(1, ...days.map(d => countsByDay[d.dateKey] || 0));

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 20,
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 500 }}>Last 30 Days</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
        {days.map(d => {
          const count = countsByDay[d.dateKey] || 0;
          const heightPct = count > 0 ? Math.max(4, (count / maxCount) * 100) : 0;
          return (
            <div
              key={d.dateKey}
              title={`${d.label}: ${count} posts`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
              }}
            >
              <div style={{
                width: '100%',
                height: `${heightPct}%`,
                background: count > 0 ? C.teal : 'transparent',
                borderRadius: '3px 3px 0 0',
                minHeight: count > 0 ? 3 : 0,
              }} />
            </div>
          );
        })}
      </div>
      {/* X-axis labels — show every 5th day */}
      <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
        {days.map((d, i) => (
          <div key={d.dateKey} style={{
            flex: 1,
            fontSize: 9,
            color: C.muted,
            textAlign: 'center',
          }}>
            {i % 5 === 0 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Platform Comparison ───
function PlatformComparison({ byPlatform }: { byPlatform: Record<string, number> }) {
  const sorted = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]);
  const max = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 20,
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 500 }}>Platform Comparison</h3>
      <div style={{ display: 'flex', gap: 16 }}>
        {sorted.map(([platform, count]) => (
          <div key={platform} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 80,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}>
              <div style={{
                width: '60%',
                height: `${Math.max(8, (count / max) * 100)}%`,
                background: PLATFORM_COLORS[platform] || C.teal,
                borderRadius: '4px 4px 0 0',
              }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6 }}>
              {platform}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Activity ───
function RecentActivity({ records }: { records: ForensicRecord[] }) {
  const recent = [...records]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 20,
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 500 }}>Recent Activity</h3>
      {recent.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No records yet</div>}
      {recent.map(r => {
        const expanded = expandedId === r.id;
        const techniques = r.techniques.map(t => t.name).join(', ') || 'none';
        const ts = new Date(r.timestamp);
        const timeStr = `${ts.toLocaleDateString()} ${ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        return (
          <div key={r.id} style={{
            borderBottom: `1px solid ${C.border}`,
            padding: '10px 0',
          }}>
            <div
              onClick={() => setExpandedId(expanded ? null : r.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 11, color: C.muted, minWidth: 120 }}>{timeStr}</span>
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: PLATFORM_COLORS[r.platform] || C.border,
                color: '#fff',
                fontWeight: 500,
              }}>
                {r.platform}
              </span>
              <span style={{ fontSize: 12, flex: 1, color: C.text }}>{techniques}</span>
              <SeverityBadge score={r.overallScore} />
              <span style={{ fontSize: 11, color: C.muted }}>{expanded ? 'Hide' : 'Details'}</span>
            </div>
            {expanded && (
              <div style={{
                marginTop: 10,
                padding: 12,
                background: C.bg,
                borderRadius: 6,
                fontSize: 12,
                lineHeight: '1.6',
              }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: C.muted }}>Original hash: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.originalHash.slice(0, 24)}...</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: C.muted }}>Original length: </span>
                  <span>{r.originalLength} chars</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: C.muted }}>Neutralized text: </span>
                  <div style={{
                    marginTop: 4,
                    padding: 8,
                    background: C.card,
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {r.neutralizedText}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.muted }}>
                  <span>AI: {r.aiSource}</span>
                  <span>Age: {r.userAgeCategory}</span>
                  <span>Integrity: <span style={{ fontFamily: 'monospace' }}>{r.integrityHash.slice(0, 16)}...</span></span>
                </div>
                {r.techniques.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {r.techniques.map((t, i) => (
                      <span key={i} style={{
                        display: 'inline-block',
                        fontSize: 11,
                        padding: '2px 8px',
                        marginRight: 4,
                        marginBottom: 4,
                        borderRadius: 4,
                        background: TECHNIQUE_COLORS[t.name] || C.border,
                        color: '#fff',
                      }}>
                        {t.name} (sev: {t.severity}, conf: {(t.confidence * 100).toFixed(0)}%)
                      </span>
                    ))}
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

// ─── Severity Badge ───
function SeverityBadge({ score }: { score: number }) {
  const color = score >= 7 ? C.red : score >= 4 ? C.amber : C.green;
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: 4,
      background: color,
      color: '#fff',
    }}>
      {score.toFixed(1)}
    </span>
  );
}

// ─── Export Button ───
function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 500,
        background: C.card,
        color: C.text,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: font,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.teal; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
    >
      {label}
    </button>
  );
}

// ─── Mount ───
createRoot(document.getElementById('root')!).render(
  <StrictMode><Dashboard /></StrictMode>
);
export default Dashboard;
