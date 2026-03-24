import { useState } from 'react';
import { FWSettings } from '../../../storage/settings';
import { C, font } from '../theme';
import { PROVIDERS, SPEED_COLORS, SPEED_LABELS, type SpeedTier } from '../provider-data';

// Cost per 1M tokens (must match settings.ts)
const COST_PER_1M: Record<string, number> = {
  deepseek: 8, anthropic: 80, openai: 15, gemini: 10,
  groq: 3, mistral: 10, xai: 20, openrouter: 15, together: 5, cohere: 10,
};

// Average tokens per check (estimated)
const AVG_TOKENS_PER_CHECK = 800;

function estimateMonthlyCost(avgDailyChecks: number, provider: string): string {
  const rate = COST_PER_1M[provider] ?? 15;
  const monthlyCents = avgDailyChecks * 30 * AVG_TOKENS_PER_CHECK * rate / 1_000_000;
  if (monthlyCents < 1) return '<$0.01';
  return `~$${(monthlyCents / 100).toFixed(2)}`;
}

// Speed bars (relative width percentages)
const SPEED_WIDTH: Record<SpeedTier, number> = {
  'ultra-fast': 100,
  'fast': 75,
  'moderate': 50,
  'slow': 25,
};

export function GuideTab({ settings }: { settings: FWSettings }) {
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  // Estimate average daily checks
  const daysActive = Math.max(1, Math.round(
    (Date.now() - new Date(settings.lastResetDate).getTime()) / 86_400_000
  ));
  const avgDailyChecks = settings.totalChecksAllTime > 0
    ? Math.round(settings.totalChecksAllTime / Math.max(daysActive, 1))
    : settings.totalChecksToday || 50;

  const picks = [
    { label: 'Fastest', provider: PROVIDERS.find(p => p.recommendation === 'Fastest')!, color: C.green },
    { label: 'Best Value', provider: PROVIDERS.find(p => p.recommendation === 'Best Value')!, color: C.amber },
    { label: 'Best Quality', provider: PROVIDERS.find(p => p.recommendation === 'Best Quality')!, color: C.teal },
  ];

  return (
    <div style={{ padding: '12px 12px', maxHeight: 420, overflowY: 'auto' }}>

      {/* Quick picks */}
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>
        Recommended
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {picks.map(({ label, provider, color }) => (
          <div
            key={label}
            style={{
              flex: 1, background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '8px 6px', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 600, color, textTransform: 'uppercase', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{provider.label}</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{provider.costPer1kChecks}/1k</div>
          </div>
        ))}
      </div>

      {/* Cost estimator */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: 12, marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>
          Cost Estimate
        </div>
        <div style={{ fontSize: 12, color: C.text, lineHeight: '1.5', marginBottom: 6 }}>
          Based on your usage (~{avgDailyChecks} checks/day):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PROVIDERS.slice(0, 6).map(p => (
            <div key={p.id} style={{
              background: C.bg, borderRadius: 4, padding: '4px 8px',
              fontSize: 10, display: 'flex', gap: 4, alignItems: 'center',
            }}>
              <span style={{ color: C.muted }}>{p.label}:</span>
              <span style={{ color: C.text, fontWeight: 500 }}>
                {estimateMonthlyCost(avgDailyChecks, p.id)}/mo
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 8, fontStyle: 'italic', lineHeight: '1.4' }}>
          FeelingWise optimizes token usage automatically to keep costs low.
        </div>
      </div>

      {/* Speed comparison */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>
          Speed Comparison
        </div>
        <div style={{ background: C.card, borderRadius: 8, padding: 12 }}>
          {PROVIDERS.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: C.muted, width: 60, flexShrink: 0, textAlign: 'right' }}>
                {p.label}
              </span>
              <div style={{
                flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${SPEED_WIDTH[p.speed]}%`,
                  background: SPEED_COLORS[p.speed], borderRadius: 4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, color: SPEED_COLORS[p.speed], width: 50, flexShrink: 0 }}>
                {SPEED_LABELS[p.speed]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Setup guides (accordion) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>
          Setup Guides
        </div>
        {PROVIDERS.map(p => (
          <div
            key={p.id}
            style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 6, marginBottom: 4, overflow: 'hidden',
            }}
          >
            <div
              onClick={() => setExpandedProvider(expandedProvider === p.id ? null : p.id)}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: C.text }}>{p.label}</span>
              <span style={{
                fontSize: 10, color: C.muted,
                transform: expandedProvider === p.id ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease', display: 'inline-block',
              }}>
                {'\u25BC'}
              </span>
            </div>
            {expandedProvider === p.id && (
              <div style={{ padding: '0 12px 10px', borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: C.muted, lineHeight: '1.7' }}>
                  {p.signupSteps.map((step, i) => (
                    <li key={i} style={{ marginBottom: 2 }}>{step}</li>
                  ))}
                </ol>
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', marginTop: 6,
                    fontSize: 10, color: C.teal, textDecoration: 'none',
                    fontFamily: font,
                  }}
                >
                  Open {p.linkLabel} &rarr;
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
