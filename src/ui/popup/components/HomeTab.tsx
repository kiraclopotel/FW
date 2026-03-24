import { CSSProperties } from 'react';
import { FWSettings } from '../../../storage/settings';
import { t } from '../../../i18n';
import { Mode } from '../../../types/mode';
import { C, font } from '../theme';
import { hasApiKey } from '../provider-data';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function CreditBattery({ credits }: { credits: number }) {
  const maxCredits = 1000;
  const pct = Math.min(100, (credits / maxCredits) * 100);
  const barColor = pct > 50 ? C.green : pct > 20 ? C.amber : C.red;

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: C.muted }}>{t('credits')}</span>
        <span style={{ color: C.muted }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
        {credits} {t('creditsRemaining')}
      </div>
    </div>
  );
}

function UsageCard({ settings }: { settings: FWSettings }) {
  const hdr: CSSProperties = { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 };
  const cell: CSSProperties = { padding: '4px 6px', fontSize: 12, textAlign: 'right' };
  const labelCell: CSSProperties = { ...cell, textAlign: 'left', fontWeight: 500 };

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 14,
      }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          {t('usage')}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...hdr, textAlign: 'left', padding: '2px 6px' }}></th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>{t('checks')}</th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>{t('fixed')}</th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>{t('tokens')}</th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>{t('cost')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...labelCell, color: C.text }}>{t('today')}</td>
              <td style={{ ...cell, color: C.text }}>{settings.totalChecksToday}</td>
              <td style={{ ...cell, color: C.text }}>{settings.totalNeutralizedToday}</td>
              <td style={{ ...cell, color: C.text }}>{formatTokens(settings.totalTokensToday)}</td>
              <td style={{ ...cell, color: C.text }}>~${settings.estimatedCostToday.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ ...labelCell, color: C.muted, fontSize: 11 }}>{t('allTime')}</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>{settings.totalChecksAllTime}</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>{settings.totalNeutralizedAllTime}</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>{formatTokens(settings.totalTokensAllTime)}</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>~${settings.estimatedCostAllTime.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HomeTab({ settings, update, onDashboard, onModeChange }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
  onDashboard: () => void;
  onModeChange: (m: Mode) => void;
}) {
  const isActive = hasApiKey(settings);
  const modes = ['child', 'teen', 'adult'] as const;
  const modeIcons = { child: '\u{1F512}', teen: '\u{1F4D6}', adult: '\u{1F441}' };

  return (
    <div>
      {/* Status */}
      {!isActive && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: C.amber, textAlign: 'center' }}>
          {t('noApiKeyConfigured')}
        </div>
      )}

      {/* Credit battery */}
      {settings.managedCredits > 0 && <CreditBattery credits={settings.managedCredits} />}

      {/* Usage card */}
      <UsageCard settings={settings} />

      {/* Daily cap */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12 }}>{t('dailyLimit')}</span>
          <span style={{ fontSize: 12, color: C.teal }}>
            {settings.dailyCap === 0 ? t('unlimited') : `${settings.dailyCap} ${t('checksPerDay')}`}
          </span>
        </div>
        <input
          type="range" min={0} max={10000} step={500}
          value={settings.dailyCap}
          onChange={e => update({ dailyCap: Number(e.target.value) })}
          style={{ width: '100%', accentColor: C.teal }}
        />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {t('protectsCredits')}
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 16px' }}>
        {modes.map(m => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            style={{
              flex: 1, padding: '10px 4px', background: C.card,
              border: `1px solid ${settings.mode === m ? C.teal : C.border}`,
              borderRadius: 6, cursor: 'pointer', textAlign: 'center', fontFamily: font,
              boxShadow: settings.mode === m ? `0 0 0 1px ${C.teal}40` : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: 16 }}>{modeIcons[m]}</div>
            <div style={{
              fontSize: 11, fontWeight: 500,
              color: settings.mode === m ? C.teal : C.muted, marginTop: 2,
            }}>
              {t(m)}
            </div>
          </button>
        ))}
      </div>

      {/* View Dashboard */}
      <div style={{ padding: '0 16px 12px' }}>
        <button
          onClick={onDashboard}
          style={{
            width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 500,
            background: 'transparent', color: C.teal,
            border: `1px solid ${C.border}`, borderRadius: 6,
            cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
          }}
        >
          {t('viewDashboard')}
        </button>
      </div>
    </div>
  );
}
