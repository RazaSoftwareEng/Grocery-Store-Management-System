/**
 * Utility to export JavaScript arrays of objects to a downloaded CSV file.
 */

export function exportToCsv(filename, headers, rows) {
  if (!rows || !rows.length) {
    window.dispatchEvent(
      new CustomEvent('app:toast', { detail: { message: 'There is nothing to export yet.', type: 'info' } })
    );
    return;
  }

  const escapeCell = (cell) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(h => escapeCell(h.label || h.key)).join(',');
  const rowLines = rows.map(row => {
    return headers.map(h => escapeCell(row[h.key])).join(',');
  });

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
