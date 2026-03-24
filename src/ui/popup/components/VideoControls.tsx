import { useState, CSSProperties } from 'react';
import { FWSettings, VideoControls as VideoControlsType, EducationalTopic } from '../../../storage/settings';
import { C, font } from '../theme';
import { ToggleSwitch } from './ToggleSwitch';

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

export function VideoControlsSection({ settings, update }: {
  settings: FWSettings;
  update: (p: Partial<FWSettings>) => Promise<void>;
}) {
  const [topicError, setTopicError] = useState('');
  const vc = settings.videoControls;

  const updateVC = (partial: Partial<VideoControlsType>) => {
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
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Comment section</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['hidden', 'Hidden entirely'], ['educational', 'Educational content']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => updateVC({ childCommentMode: val })}
                    style={{
                      flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 500,
                      background: 'transparent',
                      color: vc.childCommentMode === val ? C.teal : C.muted,
                      border: 'none',
                      borderBottom: vc.childCommentMode === val ? `2px solid ${C.teal}` : '2px solid transparent',
                      borderRadius: 0, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Hide likes, views, and shares</span>
              <ToggleSwitch checked={vc.childHideMetrics} onChange={v => updateVC({ childHideMetrics: v })} />
            </div>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Block comment posting</span>
              <ToggleSwitch checked={vc.childBlockPosting} onChange={v => updateVC({ childBlockPosting: v })} />
            </div>
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Hide action buttons (like, comment, share)</span>
              <ToggleSwitch checked={vc.childBlockActions} onChange={v => updateVC({
                childBlockActions: v,
                ...(v ? { childBlockActionsPlatforms: { tiktok: true, instagram: true, facebook: true, twitter: true } } : {}),
              })} />
            </div>
            {vc.childBlockActions && (
              <div style={{ marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {([
                  ['tiktok', 'TikTok'],
                  ['instagram', 'Instagram'],
                  ['facebook', 'Facebook'],
                  ['twitter', 'X (Twitter)'],
                ] as const).map(([key, label]) => (
                  <div key={key} style={{ ...toggleRow, paddingTop: 2, paddingBottom: 2 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                    <ToggleSwitch
                      checked={vc.childBlockActionsPlatforms?.[key] ?? true}
                      onChange={v => updateVC({
                        childBlockActionsPlatforms: { ...vc.childBlockActionsPlatforms, [key]: v },
                      })}
                    />
                  </div>
                ))}
              </div>
            )}

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
                          padding: '4px 10px', fontSize: 11, fontWeight: 500,
                          background: active ? C.teal + '22' : 'transparent',
                          color: active ? C.teal : C.muted,
                          border: `1px solid ${active ? C.teal : C.border}`,
                          borderRadius: 12, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s ease',
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

            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Comments to analyze per video</span>
                <span style={{ fontSize: 11, color: C.text }}>{vc.commentAnalysisCount}</span>
              </div>
              <input
                type="range" min={10} max={25} value={vc.commentAnalysisCount}
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
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Comments to analyze per video</span>
                <span style={{ fontSize: 11, color: C.text }}>{vc.commentAnalysisCount}</span>
              </div>
              <input
                type="range" min={10} max={25} value={vc.commentAnalysisCount}
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
            <div style={toggleRow}>
              <span style={{ fontSize: 12 }}>Block comments</span>
              <ToggleSwitch checked={vc.adultBlockComments} onChange={v => updateVC({ adultBlockComments: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
