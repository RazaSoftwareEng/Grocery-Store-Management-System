import React, { useRef } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '../common/Button';
import { useStore } from '../../context/StoreContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { printElement } from '../../utils/print';

/** Printable shift (Z) report from shift_summary() */
export function ZReport({ summary, title = 'Shift report (Z)' }) {
  const { settings, currencySymbol } = useStore();
  const ref = useRef(null);
  if (!summary) return null;
  const f = (n) => formatCurrency(n, currencySymbol);
  const closed = summary.countedCash !== null && summary.countedCash !== undefined;
  const diff = Number(summary.difference) || 0;

  const rows = [
    ['Opening cash', summary.openingCash],
    ['Cash sales', summary.cashSales, '+'],
    ['Khata collected in cash', summary.khataCollections, '+'],
    ['Cash refunds (returns)', summary.cashRefunds, '−'],
    ['Expenses paid from drawer', summary.cashExpenses, '−'],
  ];

  return (
    <div>
      <div ref={ref} className="font-mono text-xs bg-white border border-slate-200 rounded-xl p-4 space-y-2 max-w-[80mm] mx-auto">
        <div className="text-center border-b border-dashed border-slate-300 pb-2">
          <p className="font-semibold uppercase text-sm">{settings.storeName}</p>
          <p className="font-semibold">{title}</p>
          <p>{summary.cashierName}</p>
          <p>Opened {formatDate(summary.openedAt)}</p>
          {summary.closedAt && <p>Closed {formatDate(summary.closedAt)}</p>}
        </div>
        <div className="space-y-0.5 border-b border-dashed border-slate-300 pb-2">
          <Line label="Bills" value={summary.billCount} />
          <Line label="Cancelled bills" value={summary.cancelledCount} />
          <Line label="Returns" value={summary.returnsCount} />
          <Line label="Sales total" value={f(summary.salesTotal)} />
          <Line label="Discounts given" value={f(summary.discountTotal)} />
        </div>
        <div className="space-y-0.5 border-b border-dashed border-slate-300 pb-2">
          <p className="font-semibold">Takings by tender</p>
          <Line label="Cash" value={f(summary.cashSales)} />
          <Line label="Card" value={f(summary.cardSales)} />
          <Line label="Online / transfer" value={f(summary.onlineSales)} />
          <Line label="Khata (credit)" value={f(summary.creditSales)} />
          <Line label="Non-cash refunds" value={f(summary.otherRefunds)} />
        </div>
        <div className="space-y-0.5 border-b border-dashed border-slate-300 pb-2">
          <p className="font-semibold">Cash drawer</p>
          {rows.map(([label, value, sign]) => (
            <Line key={label} label={`${sign || ' '} ${label}`} value={f(value)} />
          ))}
          <Line label="= Expected cash" value={<strong>{f(summary.expectedCash)}</strong>} />
          {closed && (
            <>
              <Line label="Counted cash" value={f(summary.countedCash)} />
              <Line
                label="Difference"
                value={<strong className={diff < 0 ? 'text-rose-700' : diff > 0 ? 'text-amber-700' : ''}>{diff > 0 ? '+' : ''}{f(diff)}</strong>}
              />
            </>
          )}
        </div>
        <p className="text-center text-slate-500">Printed {formatDate(new Date().toISOString())}</p>
      </div>
      <div className="flex justify-center mt-3">
        <Button variant="secondary" size="sm" icon={Printer} onClick={() => printElement(ref.current, { pageSize: '80mm auto' })}>
          Print Z-report
        </Button>
      </div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="text-right tabular">{value}</span>
    </div>
  );
}
