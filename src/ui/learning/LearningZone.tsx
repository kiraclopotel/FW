import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
function LearningZone() {
  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h2>Learning Zone</h2>
      <p style={{ color: '#666' }}>Learning tools will appear here (Phase 9).</p>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><LearningZone /></StrictMode>
);
export default LearningZone;
