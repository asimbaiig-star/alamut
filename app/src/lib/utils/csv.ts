// Tiny CSV utility — turns a row-of-objects table into a CSV file and triggers download.
// No deps. Handles commas, quotes, newlines via RFC-4180 escaping.

function escape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCSV<T extends Record<string, unknown>>(filename: string, rows: T[], columns?: { key: keyof T; header: string }[]) {
  if (!rows.length && !columns) return;
  const cols = columns ?? Object.keys(rows[0] ?? {}).map((k) => ({ key: k as keyof T, header: k }));
  const header = cols.map((c) => escape(c.header)).join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c.key])).join(',')).join('\r\n');
  const csv = '﻿' + header + '\r\n' + body; // BOM so Excel opens UTF-8 cleanly

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
