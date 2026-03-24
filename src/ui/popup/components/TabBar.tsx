import { C, font } from '../theme';

export type TabId = 'home' | 'providers' | 'guide';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '\u2302' },
  { id: 'providers', label: 'Providers', icon: '\u26A1' },
  { id: 'guide', label: 'Guide', icon: '\u2139' },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: `1px solid ${C.border}`,
      background: C.bg,
    }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1,
            padding: '8px 0 6px',
            fontSize: 11,
            fontWeight: 500,
            background: 'transparent',
            color: active === tab.id ? C.teal : C.muted,
            border: 'none',
            borderBottom: active === tab.id ? `2px solid ${C.teal}` : '2px solid transparent',
            borderRadius: 0,
            cursor: 'pointer',
            fontFamily: font,
            transition: 'all 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 14 }}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
