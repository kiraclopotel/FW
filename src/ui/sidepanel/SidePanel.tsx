import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
function SidePanel() {
  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h2 style={{ fontSize: 16 }}>FeelingWise Analysis</h2>
      <p style={{ fontSize: 13, color: '#666' }}>Analysis will appear here.</p>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><SidePanel /></StrictMode>
);
export default SidePanel;
