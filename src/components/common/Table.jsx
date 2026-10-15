import React from 'react';
import { PackageOpen } from 'lucide-react';

export function EmptyState({ icon: Icon = PackageOpen, title, description, action, className = '' }) {
  return (
    <div className={`w-full py-12 px-4 flex flex-col items-center justify-center text-center animate-in fade-in ${className}`}>
      <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" strokeWidth={1.8} />
      </div>
      {title && <p className="text-sm font-semibold text-slate-800">{title}</p>}
      {description && <p className="text-[13px] text-slate-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const SKELETON_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-16', 'w-28', 'w-14', 'w-20'];

export function Table({
  columns = [],
  data = [],
  isLoading = false,
  emptyMessage = 'No records found.',
  emptyDescription,
  emptyAction,
  keyField = 'id',
  onRowClick,
}) {
  const head = (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        {columns.map((col, idx) => (
          <th
            key={col.key || idx}
            scope="col"
            className={`px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap ${col.headerClassName || ''}`}
          >
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  if (isLoading && (!data || data.length === 0)) {
    return (
      <div className="w-full overflow-x-auto" aria-busy="true">
        <table className="w-full text-left text-sm">
          {head}
          <tbody className="divide-y divide-slate-200">
            {Array.from({ length: 6 }).map((_, r) => (
              <tr key={r}>
                {columns.map((col, c) => (
                  <td key={col.key || c} className="px-4 py-3.5">
                    <span className={`skeleton block h-3 ${SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length]}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyMessage} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-800">
        {head}
        <tbody className="divide-y divide-slate-200">
          {data.map((row, rowIndex) => (
            <tr
              key={row[keyField] || rowIndex}
              onClick={() => onRowClick && onRowClick(row)}
              className={`transition-colors hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col, colIndex) => (
                <td key={col.key || colIndex} className={`px-4 py-3 whitespace-nowrap ${col.className || ''}`}>
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
