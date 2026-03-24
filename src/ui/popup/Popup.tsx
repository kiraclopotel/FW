import { StrictMode, useState, useEffect, CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { FWSettings, getSettings, saveSettings, resetDailyStats, setPin, verifyPin } from '../../storage/settings';
import { t, setLocale, Locale } from '../../i18n';
import { Mode } from '../../types/mode';
import { C, font } from './theme';
import { PROVIDERS, ProviderId, keyForProvider, hasApiKey } from './provider-data';
import { TabBar, TabId } from './components/TabBar';
import { HomeTab } from './components/HomeTab';
import { ProvidersTab } from './components/ProvidersTab';
import { GuideTab } from './components/GuideTab';
import { PinOverlay } from './components/PinOverlay';
import { PinSetup } from './components/PinSetup';
import { VideoControlsSection } from './components/VideoControls';
import { ToggleSwitch } from './components/ToggleSwitch';

// ─── Screens ───
type Screen = 'setup' | 'main' | 'settings';

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

  useEffect(() => {
    const handler = () => { getSettings().then(setSettings); };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

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
        <MainScreen
          settings={settings}
          update={update}
          onSettings={() => requirePin(() => setScreen('settings'))}
          onDashboard={() => requirePin(() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }))}
          onModeChange={(m: Mode) => {
            const isLessRestrictive = RESTRICTIVENESS[m] > RESTRICTIVENESS[settings.mode];
            if (isLessRestrictive && needsPin(settings)) {
              requirePin(() => update({ mode: m }));
            } else {
              update({ mode: m });
            }
          }}
        />
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

  // Step 3: provider selection
  const [provider, setProvider] = useState<ProviderId>(
    (settings.apiProvider !== 'managed' ? settings.apiProvider : 'groq') as ProviderId
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
    child: 'Ages 8-11 \u2014 Silently rewrites manipulative content',
    teen: 'Ages 12-17 \u2014 Shows what changed and why',
    adult: 'Ages 18+ \u2014 Flags manipulation, no rewriting',
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
                  padding: '14px 16px', background: C.card,
                  border: `1px solid ${selectedMode === m ? C.teal : C.border}`,
                  borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: font,
                  transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 12,
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

  // ─── Step 3: Connect AI (with scrollable provider grid) ───
  // Group providers into rows of 5 for the selector
  const providerRows = [PROVIDERS.slice(0, 5), PROVIDERS.slice(5, 10)];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>FeelingWise</span>
        <span style={{ fontSize: 11, color: C.muted }}>v0.1</span>
      </div>

      <div style={{
        background: C.card, borderLeft: `3px solid ${C.amber}`,
        borderRadius: 6, padding: 12, marginBottom: 16,
      }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Connect AI</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: '1.5' }}>
          FeelingWise uses AI to understand context. You'll need a free API key from one of these providers.
        </div>
      </div>

      {/* Provider selector — 2 rows of 5 */}
      {providerRows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 3, marginBottom: ri === 0 ? 3 : 10 }}>
          {row.map(p => (
            <button
              key={p.id}
              onClick={() => { setProvider(p.id); setError(''); }}
              style={{
                flex: 1, padding: '5px 1px', fontSize: 9, fontWeight: 500,
                background: 'transparent',
                color: provider === p.id ? C.teal : C.muted,
                border: 'none',
                borderBottom: provider === p.id ? `2px solid ${C.teal}` : '2px solid transparent',
                borderRadius: 0, cursor: 'pointer', fontFamily: font,
                transition: 'all 0.15s ease', whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      ))}

      {/* Provider tagline + speed badge */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
        <span>{meta.tagline}</span>
        <span style={{ fontSize: 9, color: C.bg, background: meta.speed === 'ultra-fast' ? C.green : meta.speed === 'fast' ? C.teal : meta.speed === 'moderate' ? C.amber : C.red, padding: '1px 4px', borderRadius: 3, fontWeight: 600 }}>
          {meta.speed === 'ultra-fast' ? 'ULTRA-FAST' : meta.speed === 'fast' ? 'FAST' : meta.speed === 'moderate' ? 'MODERATE' : 'SLOW'}
        </span>
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
            width: '100%', padding: '8px 36px 8px 10px', fontSize: 13,
            background: C.card, color: C.text,
            border: `1px solid ${error ? C.red : C.border}`,
            borderRadius: 6, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => setShowKey(!showKey)}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
            fontSize: 12, fontFamily: font,
          }}
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{error}</div>}

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
        Get a key (2 minutes) &rarr;{' '}
        <a href={meta.link} target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>
          {meta.linkLabel}
        </a>
      </div>

      <button
        onClick={handleSave}
        onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
        onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        style={{
          width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 500,
          background: C.teal, color: C.bg, border: 'none', borderRadius: 6,
          cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
        }}
      >
        {t('connectStart')}
      </button>
    </div>
  );
}

// ════════════════════════════════════
// SCREEN 2: MAIN (with tabs)
// ════════════════════════════════════
function MainScreen({ settings, update, onSettings, onDashboard, onModeChange }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
  onSettings: () => void;
  onDashboard: () => void;
  onModeChange: (m: Mode) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const isActive = hasApiKey(settings);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: 48, padding: '0 16px', borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>FeelingWise</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isActive ? C.green : C.red,
            display: 'inline-block',
            animation: isActive ? 'fw-active-pulse 2s ease-in-out infinite' : 'fw-pulse 1.5s ease-in-out infinite',
          }} />
          {isActive ? (
            <span style={{ color: C.muted }}>{t('active')}</span>
          ) : (
            <span
              onClick={() => setActiveTab('providers')}
              style={{ color: C.amber, cursor: 'pointer', fontSize: 11 }}
            >
              API key missing
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'home' && (
        <HomeTab settings={settings} update={update} onDashboard={onDashboard} onModeChange={onModeChange} />
      )}
      {activeTab === 'providers' && (
        <ProvidersTab settings={settings} update={update} />
      )}
      {activeTab === 'guide' && (
        <GuideTab settings={settings} />
      )}

      {/* Settings link */}
      <div
        onClick={onSettings}
        style={{
          textAlign: 'center', padding: '8px 0 14px', fontSize: 12,
          color: C.muted, cursor: 'pointer',
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {'\u2699'} {t('settings')}
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

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: 48, padding: '0 16px', borderBottom: `1px solid ${C.border}`,
      }}>
        <span onClick={onBack} style={{ cursor: 'pointer', fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>{'\u2190'} Back to main</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{t('settings')}</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Provider section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{t('provider')}</div>
          <div style={{
            background: C.card, borderRadius: 6, padding: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span>{providerLabel}</span>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {settings.totalChecksToday} checks today {'\u00B7'} {formatTokens(settings.totalTokensToday)} tokens
              </div>
            </div>
            <button
              onClick={onChangeKey}
              style={{
                background: 'none', border: `1px solid ${C.border}`, color: C.muted,
                fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                fontFamily: font, transition: 'all 0.15s ease',
              }}
            >
              {t('changeApiKey')}
            </button>
          </div>
        </div>

        {/* Deep scan toggle */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
          }}>
            <span style={{ fontSize: 13 }}>{t('deepScan')}</span>
            <ToggleSwitch checked={settings.deepScanEnabled} onChange={v => update({ deepScanEnabled: v })} />
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
                  flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 500,
                  background: 'transparent',
                  color: settings.locale === loc ? C.teal : C.muted,
                  border: 'none',
                  borderBottom: settings.locale === loc ? `2px solid ${C.teal}` : '2px solid transparent',
                  borderRadius: 0, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
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
              marginTop: 10, padding: '6px 12px', fontSize: 12, fontWeight: 500,
              background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 4, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
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
              width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 500,
              background: 'transparent', color: C.red, border: `1px solid ${C.border}`,
              borderRadius: 4, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
            }}
          >
            Reset daily stats
          </button>
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
