import { useState, CSSProperties } from 'react';
import { verifyPin } from '../../../storage/settings';
import { C, font } from '../theme';

export function PinOverlay({ onSuccess, onCancel }: {
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
