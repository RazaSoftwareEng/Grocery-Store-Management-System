import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Card } from '../common/Card';
import { Table } from '../common/Table';
import { Button } from '../common/Button';
import { ZReport } from '../pos/ZReport';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import { formatCurrency, formatNumber, formatShortDate, formatDate } from '../../utils/formatters';
import { todayStr } from '../../utils/dates';
import { exportToCsv } from '../../utils/exportCsv';

/** Cash flow vs profit, category profit, cashier performance, daily closing, slow stock, expiry */
export function ReportsExtras({ data, startDate, endDate }) {
  const { currencySymbol } = useStore();
  const f = (n) => formatCurrency(n, currencySymbol);
  const [closingDate, setClosingDate] = useState(todayStr());
  const [closing, setClosing] = useState(null);
  const [slowDays, setSlowDays] = useState(30);
  const [slow, setSlow] = useState([]);
  const [expiry, setExpiry] = useState([]);

  useEffect(() => {
    api.getDailyClosing(closingDate).then((r) => r.success && setClosing(r.data));
  }, [closingDate]);
  useEffect(() => {
    api.getSlowMoving(slowDays).then((r) => r.success && setSlow(r.data));
  }, [slowDays]);
  useEffect(() => {
    api.getExpiryReport(null).then((r) => r.success && setExpiry(r.data));
  }, []);

  const cf = data?.cashFlow || {};
  const csv = (name, cols, rows) => (
    <Button size="sm" variant="ghost" icon={Download} className="no-print" onClick={() => exportToCsv(`${name}_${startDate}_${endDate}`, cols, rows)}>CSV</Button>
  );
  const sumObj = (o) => Object.values(o || {}).reduce((s, v) => s + Number(v), 0);

  return (
    <div className="space-y-5">
      <Card title="Cash flow vs profit" subtitle="Khata sales count in profit but not in cash. Khata payments received count as cash.">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
          {[
            ['Sales paid now', cf.salesPaidNow],
            ['Khata (credit) sales', cf.creditSales],
            ['Refunds given', cf.refunds],
            ['Khata payments received', cf.customerPayments],
            ['Cash received', cf.cashReceived],
            ['Paid to suppliers', cf.supplierPayments],
            ['Expenses', cf.expenses],
            ['Net cash flow', cf.netCashFlow],
          ].map(([l, v]) => (
            <div key={l} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500">{l}</p>
              <p className={`font-semibold tabular ${Number(v) < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{f(v)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Gross profit {f(data?.grossProfit)} (net sales {f(data?.netSalesExTax)} before tax, after returns {f(data?.totalReturns)}).
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Profit by category" actions={csv('Profit_by_category', [
          { key: 'category', label: 'Category' }, { key: 'quantity', label: 'Qty' }, { key: 'revenue', label: 'Revenue' }, { key: 'cost', label: 'Cost' }, { key: 'profit', label: 'Profit' },
        ], data?.profitByCategory || [])} bodyClassName="p-0">
          <Table keyField="category" data={data?.profitByCategory || []} emptyMessage="No sales" columns={[
            { header: 'Category', key: 'category' },
            { header: 'Revenue', key: 'revenue', className: 'tabular', render: (r) => f(r.revenue) },
            { header: 'Profit', key: 'profit', className: 'tabular font-semibold', render: (r) => f(r.profit) },
            { header: 'Margin', key: 'm', render: (r) => (Number(r.revenue) ? `${((r.profit / r.revenue) * 100).toFixed(1)}%` : '—') },
          ]} />
        </Card>
        <Card title="Cashier performance" actions={csv('Cashier_performance', [
          { key: 'cashierName', label: 'Cashier' }, { key: 'bills', label: 'Bills' }, { key: 'sales', label: 'Sales' }, { key: 'averageBill', label: 'Avg bill' },
          { key: 'discounts', label: 'Discounts' }, { key: 'returns', label: 'Returns' }, { key: 'cancelled', label: 'Cancelled' },
        ], data?.cashierPerformance || [])} bodyClassName="p-0">
          <Table keyField="cashierId" data={data?.cashierPerformance || []} emptyMessage="No sales" columns={[
            { header: 'Cashier', key: 'cashierName' },
            { header: 'Bills', key: 'bills', className: 'tabular' },
            { header: 'Sales', key: 'sales', className: 'tabular', render: (r) => f(r.sales) },
            { header: 'Avg bill', key: 'averageBill', className: 'tabular', render: (r) => f(r.averageBill) },
            { header: 'Discounts', key: 'discounts', className: 'tabular', render: (r) => f(r.discounts) },
            { header: 'Returns / cancels', key: 'returns', render: (r) => `${f(r.returns)} · ${r.cancelled}` },
          ]} />
        </Card>
      </div>

      <Card
        title="Daily closing"
        subtitle="One store day across all shifts"
        actions={<input type="date" value={closingDate} max={todayStr()} onChange={(e) => setClosingDate(e.target.value)} aria-label="Closing date" className="no-print h-8 px-2 text-[13px] border border-slate-300 rounded-lg" />}
      >
        {closing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
              {[
                ['Bills', closing.billCount],
                ['Sales (after returns)', f(closing.salesTotal)],
                ['Gross profit', f(closing.grossProfit)],
                ['Discounts', f(closing.discountTotal)],
                ['Cash taken', f(closing.tenders?.CASH)],
                ['Card + online', f(Number(closing.tenders?.CARD || 0) + Number(closing.tenders?.ONLINE || 0))],
                ['To khata', f(closing.tenders?.CREDIT)],
                ['Khata collected', f(sumObj(closing.khataCollections))],
                ['Refunds', f(sumObj(closing.refunds))],
                ['Expenses (from drawer)', `${f(closing.expensesTotal)} (${f(closing.expensesFromDrawer)})`],
                ['Cancelled bills', closing.cancelledCount],
                ['Tax', f(closing.taxTotal)],
              ].map(([l, v]) => (
                <div key={l} className="p-3 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="font-semibold tabular">{v}</p>
                </div>
              ))}
            </div>
            {closing.shifts?.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {closing.shifts.map((s) => <ZReport key={s.shiftId} summary={s} title={`Shift ${formatDate(s.openedAt)}`} />)}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card
          title="Slow-moving & dead stock"
          subtitle={`Sold little or nothing in the last ${slowDays} days`}
          bodyClassName="p-0"
          actions={
            <div className="flex items-center gap-1">
              <select value={slowDays} onChange={(e) => setSlowDays(Number(e.target.value))} aria-label="Days" className="no-print h-8 px-2 text-[13px] border border-slate-300 rounded-lg">
                {[15, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
              {csv('Slow_moving', [
                { key: 'name', label: 'Product' }, { key: 'currentStock', label: 'Stock' }, { key: 'stockValue', label: 'Stock value' },
                { key: 'soldQty', label: 'Sold' }, { key: 'lastSoldAt', label: 'Last sold' },
              ], slow)}
            </div>
          }
        >
          <Table keyField="productId" data={slow.slice(0, 50)} emptyMessage="Everything is selling" columns={[
            { header: 'Product', key: 'name', render: (r) => <span className={r.isDead ? 'text-rose-700 font-medium' : ''}>{r.name}{r.isDead ? ' · dead' : ''}</span> },
            { header: 'Stock', key: 'currentStock', className: 'tabular', render: (r) => `${formatNumber(r.currentStock)} ${r.unit}` },
            { header: 'Value', key: 'stockValue', className: 'tabular', render: (r) => f(r.stockValue) },
            { header: 'Sold', key: 'soldQty', className: 'tabular', render: (r) => formatNumber(r.soldQty) },
            { header: 'Last sold', key: 'lastSoldAt', render: (r) => (r.lastSoldAt ? formatShortDate(r.lastSoldAt) : 'Never') },
          ]} />
        </Card>
        <Card title="Expiry report" subtitle="Expired or expiring soon" bodyClassName="p-0" actions={csv('Expiry', [
          { key: 'name', label: 'Product' }, { key: 'expiryDate', label: 'Expiry' }, { key: 'daysLeft', label: 'Days left' }, { key: 'currentStock', label: 'Stock' }, { key: 'stockValue', label: 'Value' },
        ], expiry)}>
          <Table keyField="productId" data={expiry} emptyMessage="Nothing expiring soon" columns={[
            { header: 'Product', key: 'name' },
            { header: 'Expiry', key: 'expiryDate', render: (r) => formatShortDate(r.expiryDate) },
            { header: 'Days left', key: 'daysLeft', render: (r) => <span className={r.daysLeft < 0 ? 'text-rose-600 font-semibold' : 'text-amber-700'}>{r.daysLeft < 0 ? `expired ${-r.daysLeft}d ago` : `${r.daysLeft} days`}</span> },
            { header: 'Stock', key: 'currentStock', className: 'tabular', render: (r) => `${formatNumber(r.currentStock)} ${r.unit}` },
            { header: 'Value', key: 'stockValue', className: 'tabular', render: (r) => f(r.stockValue) },
          ]} />
        </Card>
      </div>
    </div>
  );
}
