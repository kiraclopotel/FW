// FeelingWise - Forensic data exporter
// JSON and CSV export with complete metadata

import { ForensicRecord } from '../types/forensic';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportJSON(records: ForensicRecord[]): void {
  const json = JSON.stringify(records, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(blob, `feelingwise-forensics-${timestamp}.json`);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV(records: ForensicRecord[]): void {
  const header = 'timestamp,platform,techniques,severity,original_length,neutralized_text_preview';
  const rows = records.map(r => {
    const techniques = r.techniques.map(t => t.name).join(';');
    const severity = String(r.overallScore);
    const originalLength = String(r.originalLength);
    const preview = r.neutralizedText.slice(0, 100);
    return [
      escapeCSV(r.timestamp),
      escapeCSV(r.platform),
      escapeCSV(techniques),
      escapeCSV(severity),
      escapeCSV(originalLength),
      escapeCSV(preview),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(blob, `feelingwise-forensics-${timestamp}.csv`);
}
