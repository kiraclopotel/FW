import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
function Dashboard() {
  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h2>FeelingWise Dashboard</h2>
      <p style={{ color: '#666' }}>Statistics will appear here (Phase 9).</p>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><Dashboard /></StrictMode>
);
export default Dashboard;
