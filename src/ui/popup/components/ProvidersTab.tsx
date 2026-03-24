import { useState } from 'react';
import { FWSettings, saveSettings } from '../../../storage/settings';
import { C, font } from '../theme';
import { PROVIDERS, ProviderId, keyForProvider, SPEED_COLORS, SPEED_LABELS } from '../provider-data';

export function ProvidersTab({ settings, update }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<ProviderId | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const handleExpand = (id: ProviderId) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const field = keyForProvider(id);
      setKeyInput((settings[field] as string) || '');
      setShowKey(false);
      setError('');
      setSaved('');
    }
  };

  const handleSave = async (id: ProviderId) => {
    if (!keyInput.trim()) {
      setError('Please enter an API key');
      return;
    }
    const field = keyForProvider(id);
    await update({ apiProvider: id, [field]: keyInput.trim() });
    setSaved('Saved & activated');
    setError('');
    setTimeout(() => setSaved(''), 2000);
  };

  const handleActivate = async (id: ProviderId) => {
    await update({ apiProvider: id });
    setSaved('Activated');
    setTimeout(() => setSaved(''), 2000);
  };

  const handleRemoveKey = async (id: ProviderId) => {
    const field = keyForProvider(id);
    await update({ [field]: '' });
    setKeyInput('');
    if (settings.apiProvider === id) {
      await saveSettings({ apiProvider: 'deepseek' });
    }
  };

  return (
    <div style={{ padding: '8px 12px', maxHeight: 420, overflowY: 'auto' }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 8, padding: '0 4px' }}>
        10 providers available
      </div>

      {PROVIDERS.map(p => {
        const field = keyForProvider(p.id);
        const hasKey = !!(settings[field] as string);
        const isActive = settings.apiProvider === p.id && hasKey;
        const isExpanded = expandedId === p.id;

        return (
          <div
            key={p.id}
            style={{
              background: C.card,
              border: `1px solid ${isActive ? C.teal + '60' : C.border}`,
              borderRadius: 8,
              marginBottom: 6,
              overflow: 'hidden',
              transition: 'all 0.15s ease',
            }}
          >
            {/* Card header */}
            <div
              onClick={() => handleExpand(p.id)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {/* Active dot */}
                {isActive && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: C.green,
                    flexShrink: 0,
                  }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.label}</span>
                    {p.recommendation && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: C.bg,
                        background: p.recommendation === 'Fastest' ? C.green
                          : p.recommendation === 'Best Quality' ? C.teal
                          : p.recommendation === 'Best Value' ? C.amber
                          : C.muted,
                        padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase',
                      }}>
                        {p.recommendation}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{p.tagline}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {/* Speed badge */}
                <span style={{
                  fontSize: 9, fontWeight: 600,
                  color: SPEED_COLORS[p.speed],
                  border: `1px solid ${SPEED_COLORS[p.speed]}40`,
                  padding: '1px 5px', borderRadius: 3,
                }}>
                  {SPEED_LABELS[p.speed]}
                </span>
                {/* Cost tier */}
                <span style={{ fontSize: 11, color: C.muted }}>{p.costTier}</span>
                {/* Status indicator */}
                {hasKey && !isActive && (
                  <span style={{ fontSize: 9, color: C.muted }}>key set</span>
                )}
                {/* Expand indicator */}
                <span style={{
                  fontSize: 10, color: C.muted,
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease', display: 'inline-block',
                }}>
                  \u25BC
                </span>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{
                padding: '0 12px 12px',
                borderTop: `1px solid ${C.border}`,
                paddingTop: 10,
              }}>
                {/* Cost info */}
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>
                  Est. cost per 1,000 checks: <span style={{ color: C.text }}>{p.costPer1kChecks}</span>
                </div>

                {/* API key input */}
                <div style={{ position: 'relative', marginBottom: 6 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder={p.placeholder}
                    value={keyInput}
                    onChange={e => { setKeyInput(e.target.value); setError(''); setSaved(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSave(p.id)}
                    style={{
                      width: '100%', padding: '7px 36px 7px 10px', fontSize: 12,
                      background: C.bg, color: C.text,
                      border: `1px solid ${error ? C.red : C.border}`,
                      borderRadius: 6, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
                      fontSize: 11, fontFamily: font,
                    }}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>

                {error && <div style={{ fontSize: 10, color: C.red, marginBottom: 4 }}>{error}</div>}
                {saved && <div style={{ fontSize: 10, color: C.green, marginBottom: 4 }}>{saved}</div>}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleSave(p.id)}
                    style={{
                      flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 500,
                      background: C.teal, color: C.bg, border: 'none', borderRadius: 4,
                      cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
                    }}
                  >
                    Save & Activate
                  </button>
                  {hasKey && !isActive && (
                    <button
                      onClick={() => handleActivate(p.id)}
                      style={{
                        padding: '6px 10px', fontSize: 11, fontWeight: 500,
                        background: 'transparent', color: C.teal,
                        border: `1px solid ${C.teal}40`, borderRadius: 4,
                        cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
                      }}
                    >
                      Activate
                    </button>
                  )}
                  {hasKey && (
                    <button
                      onClick={() => handleRemoveKey(p.id)}
                      style={{
                        padding: '6px 10px', fontSize: 11, fontWeight: 500,
                        background: 'transparent', color: C.red,
                        border: `1px solid ${C.border}`, borderRadius: 4,
                        cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Console link */}
                <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>
                  Get a key at{' '}
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: C.teal, textDecoration: 'none' }}
                  >
                    {p.linkLabel}
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
