import { useState, CSSProperties } from 'react';
import { FWSettings, getSettings, verifyPin, setPin } from '../../../storage/settings';
import { C, font } from '../theme';

export function PinSetup({ settings, update }: { settings: FWSettings; update: (p: Partial<FWSettings>) => Promise<void> }) {
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
