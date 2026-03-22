import { StrictMode, useState, useEffect, CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { FWSettings, getSettings, saveSettings, resetDailyStats, verifyPin, setPin, VideoControls, EducationalTopic } from '../../storage/settings';
import { t, setLocale, Locale } from '../../i18n';
import { Mode } from '../../types/mode';

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
    tagline: 'Fast • $ — Best value',
    placeholder: 'sk-...',
    link: 'https://console.deepseek.com',
    linkLabel: 'console.deepseek.com',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    tagline: 'Reliable • $$',
    placeholder: 'sk-ant-...',
    link: 'https://console.anthropic.com',
    linkLabel: 'console.anthropic.com',
  },
  {
    id: 'openai',
    label: 'GPT',
    tagline: 'Reliable • $$',
    placeholder: 'sk-...',
    link: 'https://platform.openai.com',
    linkLabel: 'platform.openai.com',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    tagline: 'Fast • $ — Google',
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

// Restrictiveness order: child is most restrictive, adult is least
const RESTRICTIVENESS: Record<Mode, number> = { child: 0, teen: 1, adult: 2 };

function needsPin(settings: FWSettings): boolean {
  return !!(settings.parentPin && (settings.mode === 'child' || settings.mode === 'teen'));
}

function Popup() {
  const [settings, setSettings] = useState<FWSettings | null>(null);
  const [screen, setScreen] = useState<Screen>('setup');
  const [pinCallback, setPinCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    getSettings().then(s => {
      setLocale(s.locale as Locale);
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

  // Fix white border/bleed around popup
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = '#0a0a0a';
  }, []);

  if (!settings) return null;

  const update = async (partial: Partial<FWSettings>) => {
    await saveSettings(partial);
    setSettings((prev: FWSettings | null) => prev ? { ...prev, ...partial } : prev);
  };

  const requirePin = (action: () => void) => {
    if (needsPin(settings)) {
      setPinCallback(() => action);
    } else {
      action();
    }
  };

  const base: CSSProperties = {
    width: 320,
    minHeight: 200,
    background: C.bg,
    color: C.text,
    fontFamily: font,
    fontSize: 13,
    margin: 0,
    position: 'relative',
  };

  return (
    <div style={base}>
      {screen === 'setup' && (
        <SetupScreen settings={settings} update={update} onDone={() => setScreen('main')} />
      )}
      {screen === 'main' && (
        <MainScreen settings={settings} update={update} onSettings={() => requirePin(() => setScreen('settings'))} onDashboard={() => requirePin(() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }))} onModeChange={(m: Mode) => {
          const isLessRestrictive = RESTRICTIVENESS[m] > RESTRICTIVENESS[settings.mode];
          if (isLessRestrictive && needsPin(settings)) {
            requirePin(() => update({ mode: m }));
          } else {
            update({ mode: m });
          }
        }} />
      )}
      {screen === 'settings' && (
        <SettingsScreen settings={settings} update={update} onBack={() => setScreen('main')} onChangeKey={() => setScreen('setup')} />
      )}
      {pinCallback && (
        <PinOverlay
          onSuccess={() => { pinCallback(); setPinCallback(null); }}
          onCancel={() => setPinCallback(null)}
        />
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [pinPhase, setPinPhase] = useState<'none' | 'enter' | 'confirm'>('none');
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState('');
  const pinRefs = [
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
  ];

  // Step 3 state (existing setup)
  const [provider, setProvider] = useState<Provider>(
    (settings.apiProvider !== 'managed' ? settings.apiProvider : 'deepseek') as Provider
  );
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  const meta = PROVIDERS.find(p => p.id === provider)!;

  const handleSave = async () => {
    if (!key.trim()) {
      setError(t('enterApiKey'));
      return;
    }
    const keyField = keyForProvider(provider);
    await update({ apiProvider: provider, [keyField]: key.trim() });
    onDone();
  };

  const modeDescriptions: Record<Mode, string> = {
    child: 'Ages 8-11 — Silently rewrites manipulative content',
    teen: 'Ages 12-17 — Shows what changed and why',
    adult: 'Ages 18+ — Flags manipulation, no rewriting',
  };
  const modeIcons: Record<Mode, string> = { child: '\u{1F512}', teen: '\u{1F4D6}', adult: '\u{1F441}' };

  const handleModeSelect = async (m: Mode) => {
    setSelectedMode(m);
    await update({ mode: m });
    if (m === 'child' || m === 'teen') {
      setPinPhase('enter');
      setPinDigits(['', '', '', '']);
      setPinError('');
      setTimeout(() => pinRefs[0][0]?.focus(), 50);
    } else {
      setStep(3);
    }
  };

  const handlePinDigit = async (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...pinDigits];
    next[index] = value;
    setPinDigits(next);
    setPinError('');

    if (value && index < 3) {
      pinRefs[index + 1][0]?.focus();
    }

    if (value && index === 3) {
      const pin = next.join('');
      if (pinPhase === 'enter') {
        setFirstPin(pin);
        setPinDigits(['', '', '', '']);
        setPinPhase('confirm');
        setTimeout(() => pinRefs[0][0]?.focus(), 50);
      } else if (pinPhase === 'confirm') {
        if (pin === firstPin) {
          await setPin(pin);
          const s = await getSettings();
          await update({ parentPin: s.parentPin });
          setStep(3);
        } else {
          setPinError('PINs do not match');
          setTimeout(() => {
            setPinDigits(['', '', '', '']);
            setPinError('');
            setPinPhase('enter');
            setFirstPin('');
            pinRefs[0][0]?.focus();
          }, 600);
        }
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1][0]?.focus();
    }
  };

  const pinBoxStyle: CSSProperties = {
    width: 36, height: 42, textAlign: 'center', fontSize: 18, fontWeight: 600,
    background: C.card, color: C.text, border: `1px solid ${pinError ? C.red : C.border}`,
    borderRadius: 6, outline: 'none', fontFamily: font,
  };

  // ─── Step 1: Welcome ───
  if (step === 1) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>FeelingWise</span>
          <span style={{ fontSize: 11, color: C.muted }}>v0.1</span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: '1.4', marginBottom: 12 }}>
          FeelingWise protects your family from online manipulation
        </div>

        <div style={{ fontSize: 13, color: C.muted, lineHeight: '1.6', marginBottom: 24 }}>
          It detects psychological tricks in social media posts and rewrites them to remove
          the manipulation &mdash; same information, zero assault.
        </div>

        <button
          onClick={() => setStep(2)}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          style={{
            width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 500,
            background: C.teal, color: C.bg, border: 'none', borderRadius: 6,
            cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
          }}
        >
          Get Started &rarr;
        </button>

        <div
          onClick={() => setStep(3)}
          style={{
            fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 12,
            cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Already have an API key? Skip to setup &rarr;
        </div>
      </div>
    );
  }

  // ─── Step 2: Who is this for? ───
  if (step === 2) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>FeelingWise</span>
          <span style={{ fontSize: 11, color: C.muted }}>v0.1</span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          Who will be using this browser?
        </div>

        {pinPhase === 'none' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['child', 'teen', 'adult'] as const).map(m => (
              <button
                key={m}
                onClick={() => handleModeSelect(m)}
                style={{
                  padding: '14px 16px',
                  background: C.card,
                  border: `1px solid ${selectedMode === m ? C.teal : C.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: font,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>{modeIcons[m]}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{t(m)}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{modeDescriptions[m]}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            background: C.card, borderRadius: 8, padding: 16, textAlign: 'center',
            animation: pinError ? 'fw-shake 0.4s ease' : undefined,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              Set a parent PIN
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              {pinPhase === 'enter' ? 'Choose a 4-digit PIN to lock protection settings' : 'Confirm your PIN'}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
              {pinDigits.map((d, i) => (
                <input
                  key={`${pinPhase}-${i}`}
                  ref={el => { pinRefs[i][1](el); }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handlePinDigit(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  autoFocus={i === 0}
                  style={pinBoxStyle}
                />
              ))}
            </div>
            {pinError && <div style={{ fontSize: 11, color: C.red, marginBottom: 4 }}>{pinError}</div>}
            <div
              onClick={() => { setPinPhase('none'); setSelectedMode(null); }}
              style={{ fontSize: 11, color: C.muted, cursor: 'pointer', marginTop: 4 }}
            >
              Cancel
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Step 3: Connect AI (existing setup, refined) ───
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
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Connect AI</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: '1.5' }}>
          FeelingWise uses AI to understand context. You'll need a free API key from one of these providers.
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
              background: 'transparent',
              color: provider === p.id ? C.teal : C.muted,
              border: 'none',
              borderBottom: provider === p.id ? `2px solid ${C.teal}` : '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: font,
              transition: 'all 0.15s ease',
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
        How to get a key (2 minutes) &rarr; <a
          href={meta.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.muted, textDecoration: 'underline' }}
        >{meta.linkLabel}</a>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
        onMouseOut={e => (e.currentTarget.style.opacity = '1')}
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
          transition: 'all 0.15s ease',
        }}
      >
        {t('connectStart')}
      </button>
    </div>
  );
}

// ════════════════════════════════════
// SCREEN 2: MAIN DASHBOARD
// ════════════════════════════════════
function MainScreen({ settings, update, onSettings, onDashboard, onModeChange }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
  onSettings: () => void;
  onDashboard: () => void;
  onModeChange: (m: Mode) => void;
}) {
  const isActive = hasApiKey(settings);
  const modes = ['child', 'teen', 'adult'] as const;
  const modeIcons = { child: '🔒', teen: '📖', adult: '👁' };

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
            animation: isActive ? 'fw-active-pulse 2s ease-in-out infinite' : 'fw-pulse 1.5s ease-in-out infinite',
          }} />
          {isActive ? (
            <span style={{ color: C.muted }}>{t('active')}</span>
          ) : (
            <span
              onClick={onSettings}
              style={{ color: C.amber, cursor: 'pointer', fontSize: 11 }}
            >
              API key missing — click to reconnect
            </span>
          )}
        </div>
      </div>

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
          type="range"
          min={0}
          max={10000}
          step={500}
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
              flex: 1,
              padding: '10px 4px',
              background: C.card,
              border: `1px solid ${settings.mode === m ? C.teal : C.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'center',
              fontFamily: font,
              boxShadow: settings.mode === m ? `0 0 0 1px ${C.teal}40` : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: 16 }}>{modeIcons[m]}</div>
            <div style={{
              fontSize: 11,
              fontWeight: 500,
              color: settings.mode === m ? C.teal : C.muted,
              marginTop: 2,
            }}>
              {t(m)}
            </div>
          </button>
        ))}
      </div>

      {/* View Dashboard button */}
      <div style={{ padding: '0 16px 12px' }}>
        <button
          onClick={onDashboard}
          style={{
            width: '100%',
            padding: '8px 0',
            fontSize: 12,
            fontWeight: 500,
            background: 'transparent',
            color: C.teal,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: font,
            transition: 'all 0.15s ease',
          }}
        >
          → View Dashboard
        </button>
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
        ⚙ {t('settings')}
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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
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
          Usage
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...hdr, textAlign: 'left', padding: '2px 6px' }}></th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>Checks</th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>Fixed</th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>Tokens</th>
              <th style={{ ...hdr, textAlign: 'right', padding: '2px 6px' }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...labelCell, color: C.text }}>Today</td>
              <td style={{ ...cell, color: C.text }}>{settings.totalChecksToday}</td>
              <td style={{ ...cell, color: C.text }}>{settings.totalNeutralizedToday}</td>
              <td style={{ ...cell, color: C.text }}>{formatTokens(settings.totalTokensToday)}</td>
              <td style={{ ...cell, color: C.text }}>~${(settings.estimatedCostToday / 100).toFixed(3)}</td>
            </tr>
            <tr>
              <td style={{ ...labelCell, color: C.muted, fontSize: 11 }}>All time</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>{settings.totalChecksAllTime}</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>{settings.totalNeutralizedAllTime}</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>{formatTokens(settings.totalTokensAllTime)}</td>
              <td style={{ ...cell, color: C.muted, fontSize: 11 }}>~${(settings.estimatedCostAllTime / 100).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 48,
        padding: '0 16px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span onClick={onBack} style={{ cursor: 'pointer', fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>← Back to main</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{t('settings')}</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Provider section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{t('provider')}</div>
          <div style={{
            background: C.card,
            borderRadius: 6,
            padding: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <span>{providerLabel}</span>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {settings.totalChecksToday} checks today · {formatTokens(settings.totalTokensToday)} tokens
              </div>
            </div>
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
                transition: 'all 0.15s ease',
              }}
            >
              {t('changeApiKey')}
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
            <span style={{ fontSize: 13 }}>{t('deepScan')}</span>
            <ToggleSwitch
              checked={settings.deepScanEnabled}
              onChange={v => update({ deepScanEnabled: v })}
            />
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: '1.4' }}>
            {t('deepScanDesc')}
          </div>
        </div>

        {/* Language selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{t('language')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['en', 'ro'] as Locale[]).map(loc => (
              <button
                key={loc}
                onClick={() => { update({ locale: loc }); setLocale(loc); }}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'transparent',
                  color: settings.locale === loc ? C.teal : C.muted,
                  border: 'none',
                  borderBottom: settings.locale === loc ? `2px solid ${C.teal}` : '2px solid transparent',
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontFamily: font,
                  transition: 'all 0.15s ease',
                }}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Parent PIN */}
        <PinSetup settings={settings} update={update} />

        {/* Video Platform Controls */}
        <VideoControlsSection settings={settings} update={update} />

        {/* About */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{t('about')}</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: '1.6' }}>
            FeelingWise v0.1<br />
            {t('aboutText')}
          </div>
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })}
            style={{
              marginTop: 10,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: 'transparent',
              color: C.muted,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: font,
              transition: 'all 0.15s ease',
            }}
          >
            Full Dashboard
          </button>
        </div>

        {/* Reset daily stats */}
        <div>
          <button
            onClick={async () => { await resetDailyStats(); const s = await getSettings(); update(s); }}
            style={{
              width: '100%',
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 500,
              background: 'transparent',
              color: C.red,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: font,
              transition: 'all 0.15s ease',
            }}
          >
            Reset daily stats
          </button>
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

// ════════════════════════════════════
// VIDEO PLATFORM CONTROLS
// ════════════════════════════════════
const ALL_TOPICS: { id: EducationalTopic; label: string }[] = [
  { id: 'science', label: 'Science' },
  { id: 'nature', label: 'Nature' },
  { id: 'history', label: 'History' },
  { id: 'math', label: 'Math' },
  { id: 'languages', label: 'Languages' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'arts', label: 'Arts' },
  { id: 'technology', label: 'Technology' },
];

function VideoControlsSection({ settings, update }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
}) {
  const [topicError, setTopicError] = useState('');
  const vc = settings.videoControls;

  const updateVC = (partial: Partial<VideoControls>) => {
    update({ videoControls: { ...vc, ...partial } });
  };

  const toggleTopic = (topic: EducationalTopic) => {
    const current = vc.educationalTopics;
    if (current.includes(topic)) {
      if (current.length <= 1) {
        setTopicError('At least one topic required');
        setTimeout(() => setTopicError(''), 2000);
        return;
      }
      updateVC({ educationalTopics: current.filter(t => t !== topic) });
    } else {
      updateVC({ educationalTopics: [...current, topic] });
    }
  };

  const toggleRow: CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Video Platform Controls</div>
      <div style={{ background: C.card, borderRadius: 8, padding: 14 }}>
        {settings.mode === 'child' && (
          <>
            {/* Comment section mode */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Comment section</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['hidden', 'Hidden entirely'], ['educational', 'Educational content']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => updateVC({ childCommentMode: val })}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      fontSize: 11,
                      fontWeight: 500,
                      background: 'transparent',
                      color: vc.childCommentMode === val ? C.teal : C.muted,
                      border: 'none',
                      borderBottom: vc.childCommentMode === val ? `2px solid ${C.teal}` : '2px solid transparent',
                      borderRadius: 0,
                      cursor: 'pointer',
                      fontFamily: font,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Hide likes, views, and shares</span>
              <ToggleSwitch checked={vc.childHideMetrics} onChange={v => updateVC({ childHideMetrics: v })} />
            </div>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Block comment posting</span>
              <ToggleSwitch checked={vc.childBlockPosting} onChange={v => updateVC({ childBlockPosting: v })} />
            </div>

            {/* Educational topics (only when educational mode) */}
            {vc.childCommentMode === 'educational' && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Educational topics</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ALL_TOPICS.map(({ id, label }) => {
                    const active = vc.educationalTopics.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleTopic(id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 500,
                          background: active ? C.teal + '22' : 'transparent',
                          color: active ? C.teal : C.muted,
                          border: `1px solid ${active ? C.teal : C.border}`,
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontFamily: font,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {topicError && (
                  <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>{topicError}</div>
                )}
              </div>
            )}

            {/* Comment analysis count */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Comments to analyze per video</span>
                <span style={{ fontSize: 11, color: C.text }}>{vc.commentAnalysisCount}</span>
              </div>
              <input
                type="range"
                min={10}
                max={25}
                value={vc.commentAnalysisCount}
                onChange={e => updateVC({ commentAnalysisCount: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 4, accentColor: C.teal }}
              />
            </div>
          </>
        )}

        {settings.mode === 'teen' && (
          <>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Show rewritten comments first</span>
              <ToggleSwitch checked={vc.teenRewriteComments} onChange={v => updateVC({ teenRewriteComments: v })} />
            </div>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Hide engagement numbers</span>
              <ToggleSwitch checked={vc.teenHideMetrics} onChange={v => updateVC({ teenHideMetrics: v })} />
            </div>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Show technique explanations</span>
              <ToggleSwitch checked={vc.teenShowLessons} onChange={v => updateVC({ teenShowLessons: v })} />
            </div>

            {/* Comment analysis count */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Comments to analyze per video</span>
                <span style={{ fontSize: 11, color: C.text }}>{vc.commentAnalysisCount}</span>
              </div>
              <input
                type="range"
                min={10}
                max={25}
                value={vc.commentAnalysisCount}
                onChange={e => updateVC({ commentAnalysisCount: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 4, accentColor: C.teal }}
              />
            </div>
          </>
        )}

        {settings.mode === 'adult' && (
          <>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Clean language mode</span>
              <ToggleSwitch checked={vc.adultCleanLanguage} onChange={v => updateVC({ adultCleanLanguage: v })} />
            </div>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Hide engagement numbers</span>
              <ToggleSwitch checked={vc.adultHideMetrics} onChange={v => updateVC({ adultHideMetrics: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════
// PIN SETUP (in Settings screen)
// ════════════════════════════════════
function PinSetup({ settings, update }: { settings: FWSettings; update: (p: Partial<FWSettings>) => Promise<void> }) {
  const [phase, setPhase] = useState<'idle' | 'verify-current' | 'enter-new' | 'confirm-new'>('idle');
  const [newPin, setNewPin] = useState('');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const inputRefs = [
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
  ];

  const hasPin = !!settings.parentPin;

  const resetForm = () => {
    setPhase('idle');
    setNewPin('');
    setDigits(['', '', '', '']);
    setError('');
  };

  const handleStart = () => {
    setDigits(['', '', '', '']);
    setError('');
    if (hasPin) {
      setPhase('verify-current');
    } else {
      setPhase('enter-new');
    }
  };

  const handleDigit = async (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError('');

    if (value && index < 3) {
      inputRefs[index + 1][0]?.focus();
    }

    if (value && index === 3) {
      const pin = next.join('');
      if (phase === 'verify-current') {
        const ok = await verifyPin(pin);
        if (ok) {
          setDigits(['', '', '', '']);
          setPhase('enter-new');
        } else {
          setError('Wrong PIN');
          setTimeout(() => { setDigits(['', '', '', '']); setError(''); inputRefs[0][0]?.focus(); }, 600);
        }
      } else if (phase === 'enter-new') {
        setNewPin(pin);
        setDigits(['', '', '', '']);
        setPhase('confirm-new');
        setTimeout(() => inputRefs[0][0]?.focus(), 50);
      } else if (phase === 'confirm-new') {
        if (pin === newPin) {
          await setPin(pin);
          const s = await getSettings();
          await update({ parentPin: s.parentPin });
          resetForm();
        } else {
          setError('PINs do not match');
          setTimeout(() => { setDigits(['', '', '', '']); setError(''); setPhase('enter-new'); setNewPin(''); inputRefs[0][0]?.focus(); }, 600);
        }
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1][0]?.focus();
    }
    if (e.key === 'Escape') resetForm();
  };

  const boxStyle: CSSProperties = {
    width: 36, height: 42, textAlign: 'center', fontSize: 18, fontWeight: 600,
    background: C.card, color: C.text, border: `1px solid ${error ? C.red : C.border}`,
    borderRadius: 6, outline: 'none', fontFamily: font,
  };

  const label = phase === 'verify-current' ? 'Enter current PIN'
    : phase === 'enter-new' ? (hasPin ? 'Enter new PIN' : 'Set a 4-digit PIN')
    : phase === 'confirm-new' ? 'Confirm PIN' : '';

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Parent PIN</div>
      {phase === 'idle' ? (
        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 500,
            background: 'transparent', color: C.teal, border: `1px solid ${C.border}`,
            borderRadius: 4, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
          }}
        >
          {hasPin ? 'Change PIN' : 'Set Parent PIN'}
        </button>
      ) : (
        <div style={{
          background: C.card, borderRadius: 8, padding: 14, textAlign: 'center',
          animation: error ? 'fw-shake 0.4s ease' : undefined,
        }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{label}</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
            {digits.map((d, i) => (
              <input
                key={`${phase}-${i}`}
                ref={el => { inputRefs[i][1](el); }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                autoFocus={i === 0}
                style={boxStyle}
              />
            ))}
          </div>
          {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 4 }}>{error}</div>}
          <div onClick={resetForm} style={{ fontSize: 11, color: C.muted, cursor: 'pointer' }}>Cancel</div>
        </div>
      )}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: '1.4' }}>
        {hasPin ? 'PIN is set. Required to weaken protection mode.' : 'Set a PIN to prevent children from changing protection mode.'}
      </div>
    </div>
  );
}

// ════════════════════════════════════
// PIN OVERLAY
// ════════════════════════════════════
function PinOverlay({ onSuccess, onCancel }: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const inputRefs = [
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
  ];

  const handleDigit = async (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(false);

    if (value && index < 3) {
      inputRefs[index + 1][0]?.focus();
    }

    // Auto-verify when all 4 digits entered
    if (value && index === 3) {
      const pin = next.join('');
      const ok = await verifyPin(pin);
      if (ok) {
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => { setDigits(['', '', '', '']); setError(false); inputRefs[0][0]?.focus(); }, 600);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1][0]?.focus();
    }
    if (e.key === 'Escape') onCancel();
  };

  const boxStyle: CSSProperties = {
    width: 40, height: 48, textAlign: 'center', fontSize: 20, fontWeight: 600,
    background: C.card, color: C.text, border: `1px solid ${error ? C.red : C.border}`,
    borderRadius: 8, outline: 'none', fontFamily: font,
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24,
        textAlign: 'center', animation: error ? 'fw-shake 0.4s ease' : undefined,
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: C.text }}>Enter PIN</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs[i][1](el); }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              style={boxStyle}
            />
          ))}
        </div>
        {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>Wrong PIN</div>}
        <div
          onClick={onCancel}
          style={{ fontSize: 12, color: C.muted, cursor: 'pointer', marginTop: 4 }}
        >
          Cancel
        </div>
      </div>
    </div>
  );
}

// ─── Pulse animation ───
const style = document.createElement('style');
style.textContent = `@keyframes fw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes fw-active-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes fw-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }`;
document.head.appendChild(style);

// ─── Mount ───
createRoot(document.getElementById('root')!).render(
  <StrictMode><Popup /></StrictMode>
);

export default Popup;
