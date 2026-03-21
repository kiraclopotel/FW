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
  const header = 'timestamp,platform,author,post_url,techniques,severity,original_length,original_text,neutralized_text';
  const rows = records.map(r => {
    const techniques = r.techniques.map(t => t.name).join(';');
    return [
      escapeCSV(r.timestamp),
      escapeCSV(r.platform),
      escapeCSV(r.author),
      escapeCSV(r.postUrl),
      escapeCSV(techniques),
      escapeCSV(String(r.overallScore)),
      escapeCSV(String(r.originalLength)),
      escapeCSV(r.originalText),
      escapeCSV(r.neutralizedText),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(blob, `feelingwise-forensics-${timestamp}.csv`);
}
