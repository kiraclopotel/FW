import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
function Popup() {
  return (
    <div style={{ width: 300, padding: 16, fontFamily: 'system-ui' }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>FeelingWise</h2>
      <p style={{ fontSize: 13, color: '#666' }}>Active — monitoring for manipulation.</p>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><Popup /></StrictMode>
);
export default Popup;
