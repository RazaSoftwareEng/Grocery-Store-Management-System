import React from 'react';
import { PackageOpen } from 'lucide-react';

export function Table({
  columns = [],
  data = [],
  isLoading = false,
  emptyMessage = 'No records found.',
  keyField = 'id',
  onRowClick,
}) {
  if (isLoading) {
    return (
      <div className="w-full p-8 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading data from Google Sheets...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full py-12 px-4 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
        <PackageOpen className="w-12 h-12 text-slate-300 stroke-1" />
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-700">
        <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50/75 border-b border-slate-200">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={`px-4 py-3 font-semibold ${col.headerClassName || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, rowIndex) => (
            <tr
              key={row[keyField] || rowIndex}
              onClick={() => onRowClick && onRowClick(row)}
              className={`hover:bg-slate-50/80 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {columns.map((col, colIndex) => (
                <td
                  key={col.key || colIndex}
                  className={`px-4 py-3.5 whitespace-nowrap ${col.className || ''}`}
                >
                  {col.render ? col.render(row, rowIndex) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
