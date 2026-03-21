import { StrictMode, useState, useEffect, CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { FWSettings, getSettings, saveSettings } from '../../storage/settings';

// ─── Color palette ───
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

// ─── Provider metadata ───
type Provider = 'anthropic' | 'openai' | 'deepseek' | 'gemini';

const PROVIDERS: {
  id: Provider;
  label: string;
  tagline: string;
  placeholder: string;
  link: string;
  linkLabel: string;
}[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    tagline: 'Fast \u2022 $ \u2014 Best value',
    placeholder: 'sk-...',
    link: 'https://console.deepseek.com',
    linkLabel: 'console.deepseek.com',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    tagline: 'Reliable \u2022 $$',
    placeholder: 'sk-ant-...',
    link: 'https://console.anthropic.com',
    linkLabel: 'console.anthropic.com',
  },
  {
    id: 'openai',
    label: 'GPT',
    tagline: 'Reliable \u2022 $$',
    placeholder: 'sk-...',
    link: 'https://platform.openai.com',
    linkLabel: 'platform.openai.com',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    tagline: 'Fast \u2022 $ \u2014 Google',
    placeholder: 'AIza...',
    link: 'https://aistudio.google.com',
    linkLabel: 'aistudio.google.com',
  },
];

function keyForProvider(provider: Provider): keyof FWSettings {
  switch (provider) {
    case 'anthropic': return 'anthropicApiKey';
    case 'openai': return 'openaiApiKey';
    case 'deepseek': return 'deepSeekApiKey';
    case 'gemini': return 'geminiApiKey';
  }
}

function hasApiKey(s: FWSettings): boolean {
  return !!(s.anthropicApiKey || s.openaiApiKey || s.deepSeekApiKey || s.geminiApiKey);
}

// ─── Screens ───
type Screen = 'setup' | 'main' | 'settings';

function Popup() {
  const [settings, setSettings] = useState<FWSettings | null>(null);
  const [screen, setScreen] = useState<Screen>('setup');

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setScreen(hasApiKey(s) ? 'main' : 'setup');
    });
  }, []);

  // Listen for storage changes to live-update stats
  useEffect(() => {
    const handler = () => {
      getSettings().then(setSettings);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  if (!settings) return null;

  const update = async (partial: Partial<FWSettings>) => {
    await saveSettings(partial);
    setSettings((prev: FWSettings | null) => prev ? { ...prev, ...partial } : prev);
  };

  const base: CSSProperties = {
    width: 320,
    minHeight: 200,
    background: C.bg,
    color: C.text,
    fontFamily: font,
    fontSize: 13,
  };

  return (
    <div style={base}>
      {screen === 'setup' && (
        <SetupScreen settings={settings} update={update} onDone={() => setScreen('main')} />
      )}
      {screen === 'main' && (
        <MainScreen settings={settings} update={update} onSettings={() => setScreen('settings')} />
      )}
      {screen === 'settings' && (
        <SettingsScreen settings={settings} update={update} onBack={() => setScreen('main')} onChangeKey={() => setScreen('setup')} />
      )}
    </div>
  );
}

// ════════════════════════════════════
// SCREEN 1: SETUP
// ════════════════════════════════════
function SetupScreen({ settings, update, onDone }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
  onDone: () => void;
}) {
  const [provider, setProvider] = useState<Provider>(
    (settings.apiProvider !== 'managed' ? settings.apiProvider : 'deepseek') as Provider
  );
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  const meta = PROVIDERS.find(p => p.id === provider)!;

  const handleSave = async () => {
    if (!key.trim()) {
      setError('Please enter an API key');
      return;
    }
    const keyField = keyForProvider(provider);
    await update({ apiProvider: provider, [keyField]: key.trim() });
    onDone();
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>FeelingWise</span>
        <span style={{ fontSize: 11, color: C.muted }}>v0.1</span>
      </div>

      {/* Info card */}
      <div style={{
        background: C.card,
        borderLeft: `3px solid ${C.amber}`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Connect your AI</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: '1.5' }}>
          FeelingWise needs an AI provider to detect and rewrite manipulation.
          Use your own API key — you control costs.
        </div>
      </div>

      {/* Provider tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => { setProvider(p.id); setError(''); }}
            style={{
              flex: 1,
              padding: '6px 2px',
              fontSize: 11,
              fontWeight: 500,
              background: provider === p.id ? C.teal : C.card,
              color: provider === p.id ? C.bg : C.muted,
              border: `1px solid ${provider === p.id ? C.teal : C.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: font,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Provider tagline */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textAlign: 'center' }}>
        {meta.tagline}
      </div>

      {/* Key input */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <input
          type={showKey ? 'text' : 'password'}
          placeholder={meta.placeholder}
          value={key}
          onChange={e => { setKey(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={{
            width: '100%',
            padding: '8px 36px 8px 10px',
            fontSize: 13,
            background: C.card,
            color: C.text,
            border: `1px solid ${error ? C.red : C.border}`,
            borderRadius: 6,
            outline: 'none',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => setShowKey(!showKey)}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: C.muted,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: font,
          }}
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{error}</div>}

      {/* Link */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
        Get a free key → <a
          href={meta.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.muted, textDecoration: 'underline' }}
        >{meta.linkLabel}</a>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '10px 0',
          fontSize: 14,
          fontWeight: 500,
          background: C.teal,
          color: C.bg,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: font,
        }}
      >
        Connect & Start
      </button>
    </div>
  );
}

// ════════════════════════════════════
// SCREEN 2: MAIN DASHBOARD
// ════════════════════════════════════
function MainScreen({ settings, update, onSettings }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
  onSettings: () => void;
}) {
  const isActive = hasApiKey(settings);
  const modes = ['child', 'teen', 'adult'] as const;
  const modeIcons = { child: '\uD83D\uDD12', teen: '\uD83D\uDCD6', adult: '\uD83D\uDC41' };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 48,
        padding: '0 16px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>FeelingWise</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isActive ? C.green : C.red,
            display: 'inline-block',
          }} />
          <span style={{ color: C.muted }}>{isActive ? 'Active' : 'Paused'}</span>
        </div>
      </div>

      {/* Credit battery */}
      {settings.managedCredits > 0 && <CreditBattery credits={settings.managedCredits} />}

      {/* Today's stats */}
      <div style={{ display: 'flex', gap: 8, padding: 16 }}>
        <StatCard value={settings.totalChecksToday} label="posts scanned" />
        <StatCard value={settings.totalNeutralizedToday} label="neutralized" />
      </div>

      {/* Token usage */}
      <div style={{ padding: '0 16px 12px', fontSize: 11, color: C.muted, display: 'flex', justifyContent: 'space-between' }}>
        <span>{settings.totalTokensToday.toLocaleString()} tokens used today</span>
        <span>~${(settings.estimatedCostToday / 100).toFixed(3)}</span>
      </div>

      {/* Daily cap */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12 }}>Daily AI limit</span>
          <span style={{ fontSize: 12, color: C.teal }}>
            {settings.dailyCap === 0 ? 'Unlimited' : `${settings.dailyCap} checks/day`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={500}
          step={50}
          value={settings.dailyCap}
          onChange={e => update({ dailyCap: Number(e.target.value) })}
          style={{ width: '100%', accentColor: C.teal }}
        />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          Protects your credits on heavy scroll days
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 16px' }}>
        {modes.map(m => (
          <button
            key={m}
            onClick={() => update({ mode: m })}
            style={{
              flex: 1,
              padding: '10px 4px',
              background: C.card,
              border: `1px solid ${settings.mode === m ? C.teal : C.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'center',
              fontFamily: font,
            }}
          >
            <div style={{ fontSize: 16 }}>{modeIcons[m]}</div>
            <div style={{
              fontSize: 11,
              fontWeight: 500,
              color: settings.mode === m ? C.teal : C.muted,
              marginTop: 2,
              textTransform: 'capitalize',
            }}>
              {m}
            </div>
          </button>
        ))}
      </div>

      {/* Settings link */}
      <div
        onClick={onSettings}
        style={{
          textAlign: 'center',
          padding: '8px 0 14px',
          fontSize: 12,
          color: C.muted,
          cursor: 'pointer',
        }}
      >
        \u2699 Settings
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      flex: 1,
      background: C.card,
      borderRadius: 8,
      padding: 14,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 600, color: C.teal }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CreditBattery({ credits }: { credits: number }) {
  const maxCredits = 1000; // assumed max for percentage
  const pct = Math.min(100, (credits / maxCredits) * 100);
  const barColor = pct > 50 ? C.green : pct > 20 ? C.amber : C.red;

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: C.muted }}>Credits</span>
        <span style={{ color: C.muted }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
        {credits} credits remaining
      </div>
    </div>
  );
}

// ════════════════════════════════════
// SCREEN 3: SETTINGS
// ════════════════════════════════════
function SettingsScreen({ settings, update, onBack, onChangeKey }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
  onBack: () => void;
  onChangeKey: () => void;
}) {
  const providerLabel = PROVIDERS.find(p => p.id === settings.apiProvider)?.label ?? settings.apiProvider;

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 48,
        padding: '0 16px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span onClick={onBack} style={{ cursor: 'pointer', fontSize: 16 }}>\u2190</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Settings</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Provider section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>PROVIDER</div>
          <div style={{
            background: C.card,
            borderRadius: 6,
            padding: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{providerLabel}</span>
            <button
              onClick={onChangeKey}
              style={{
                background: 'none',
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: font,
              }}
            >
              Change API key
            </button>
          </div>
        </div>

        {/* Deep scan toggle */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 13 }}>Deep scan for uncertain posts</span>
            <ToggleSwitch
              checked={settings.deepScanEnabled}
              onChange={v => update({ deepScanEnabled: v })}
            />
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: '1.4' }}>
            Uses slower, smarter model for ambiguous content. Uses more credits.
          </div>
        </div>

        {/* About */}
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>ABOUT</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: '1.6' }}>
            FeelingWise v0.1<br />
            Built to make manipulation visible. Never to censor.
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? C.teal : C.border,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: C.text,
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

// ─── Mount ───
createRoot(document.getElementById('root')!).render(
  <StrictMode><Popup /></StrictMode>
);

export default Popup;
