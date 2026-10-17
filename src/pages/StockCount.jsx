import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ClipboardCheck, Plus, Printer, Save, CheckCircle2, ArrowLeft, Ban } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api } from '../services/api';
import { PageHeader, Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';
import { Select, Input } from '../components/common/Input';
import { SearchInput } from '../components/common/SearchInput';
import { formatDate, formatNumber, formatCurrency, round2 } from '../utils/formatters';
import { printElement } from '../utils/print';

export function StockCount() {
  const { categories, currencySymbol, refreshProducts, settings } = useStore();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [counts, setCounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [active, setActive] = useState(null); // { count, items }
  const [entered, setEntered] = useState({});
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const sheetRef = useRef(null);

  const loadCounts = useCallback(async () => {
    setIsLoading(true);
    const res = await api.getStockCounts();
    setIsLoading(false);
    if (res.success) setCounts(res.data);
    else showToast(res.error, 'error');
  }, [showToast]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const openCount = async (countId) => {
    const res = await api.getStockCount(countId);
    if (!res.success) return showToast(res.error, 'error');
    setActive(res.data);
    setEntered(Object.fromEntries(res.data.items.map((i) => [i.itemId, i.countedQty === null ? '' : String(i.countedQty)])));
    setSearch('');
  };

  const startCount = async () => {
    setBusy('start');
    const res = await api.startStockCount(categoryId, notes);
    setBusy('');
    if (!res.success) return showToast(res.error, 'error');
    showToast(`${res.data.countNumber} started with ${res.data.itemCount} products`, 'success');
    setNotes('');
    loadCounts();
    openCount(res.data.countId);
  };

  const changedItems = () =>
    (active?.items || [])
      .filter((i) => (i.countedQty === null ? '' : String(i.countedQty)) !== (entered[i.itemId] ?? ''))
      .map((i) => ({ itemId: i.itemId, countedQty: entered[i.itemId] ?? '' }));

  const save = async () => {
    const items = changedItems();
    if (!items.length) {
      showToast('Nothing new to save', 'info');
      return true;
    }
    setBusy('save');
    const res = await api.saveStockCountItems(items);
    setBusy('');
    if (!res.success) {
      showToast(res.error, 'error');
      return false;
    }
    showToast(`${items.length} counts saved`, 'success');
    await openCount(active.count.countId);
    return true;
  };

  const apply = async () => {
    const lines = (active?.items || []).filter((i) => entered[i.itemId] !== '' && Number(entered[i.itemId]) !== Number(i.systemQty));
    if (!(await confirm({
      title: 'Apply this stock count?',
      message: `${lines.length} products will get a stock adjustment for the difference found. Products not counted are left as they are. This cannot be undone.`,
      confirmText: 'Apply count',
    }))) return;
    if (!(await save())) return;
    setBusy('apply');
    const res = await api.applyStockCount(active.count.countId);
    setBusy('');
    if (!res.success) return showToast(res.error, 'error');
    showToast(`Stock updated for ${res.data.linesAdjusted} products`, 'success');
    refreshProducts();
    loadCounts();
    openCount(active.count.countId);
  };

  const cancel = async () => {
    if (!(await confirm({ title: 'Cancel this stock count?', confirmText: 'Cancel count', tone: 'danger' }))) return;
    const res = await api.cancelStockCount(active.count.countId);
    if (!res.success) return showToast(res.error, 'error');
    showToast(res.message, 'success');
    setActive(null);
    loadCounts();
  };

  if (active) {
    const isOpen = active.count.status === 'OPEN';
    const q = search.trim().toLowerCase();
    const rows = active.items.filter((i) => !q || i.productName?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
    const counted = active.items.filter((i) => entered[i.itemId] !== '' && entered[i.itemId] !== undefined);
    const varianceValue = round2(counted.reduce((s, i) => s + (Number(entered[i.itemId]) - Number(i.systemQty)) * Number(i.unitCost), 0));

    return (
      <div className="space-y-4">
        <PageHeader
          icon={ClipboardCheck}
          title={`Stock count ${active.count.countNumber}`}
          description={`${active.count.status} · started ${formatDate(active.count.createdAt)} by ${active.count.createdBy}`}
          actions={
            <>
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setActive(null)}>All counts</Button>
              <Button variant="secondary" icon={Printer} onClick={() => printElement(sheetRef.current, { pageSize: 'A4' })}>Print sheet</Button>
              {isOpen && (
                <>
                  <Button variant="ghost" icon={Ban} onClick={cancel}>Cancel</Button>
                  <Button variant="secondary" icon={Save} onClick={save} isLoading={busy === 'save'}>Save counts</Button>
                  <Button icon={CheckCircle2} onClick={apply} isLoading={busy === 'apply'}>Review & apply</Button>
                </>
              )}
            </>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Products" value={active.items.length} />
          <Stat label="Counted" value={counted.length} />
          <Stat label="With difference" value={counted.filter((i) => Number(entered[i.itemId]) !== Number(i.systemQty)).length} />
          <Stat label="Variance value (cost)" value={formatCurrency(varianceValue, currencySymbol)} tone={varianceValue < 0 ? 'text-rose-600' : 'text-slate-900'} />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Find a product on the sheet" className="max-w-sm" />

        <div ref={sheetRef} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
          <div className="print-only p-3 text-sm">
            <p className="font-semibold">{settings.storeName} · Stock count {active.count.countNumber}</p>
            <p>Date: {formatDate(active.count.createdAt)} · Counted by: ____________________</p>
          </div>
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">Product</th>
                <th className="text-left px-4 py-2.5">SKU</th>
                <th className="text-right px-4 py-2.5">System qty</th>
                <th className="text-right px-4 py-2.5 w-36">Counted qty</th>
                <th className="text-right px-4 py-2.5">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((i) => {
                const val = entered[i.itemId] ?? '';
                const diff = val === '' ? null : round2(Number(val) - Number(i.systemQty));
                return (
                  <tr key={i.itemId}>
                    <td className="px-4 py-2 font-medium text-slate-900">{i.productName}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{i.sku}</td>
                    <td className="px-4 py-2 text-right tabular">{formatNumber(i.systemQty)} {i.unit}</td>
                    <td className="px-4 py-2 text-right">
                      {isOpen ? (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={val}
                          onChange={(e) => setEntered((prev) => ({ ...prev, [i.itemId]: e.target.value }))}
                          aria-label={`Counted quantity of ${i.productName}`}
                          className="no-print w-28 h-8 px-2 text-right tabular border border-slate-300 rounded-lg"
                        />
                      ) : (
                        <span className="tabular">{val === '' ? '—' : formatNumber(val)}</span>
                      )}
                      <span className="print-only">______</span>
                    </td>
                    <td className={`px-4 py-2 text-right tabular font-semibold ${diff === null ? 'text-slate-300' : diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                      {diff === null ? '—' : diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader icon={ClipboardCheck} title="Stock count" description="Count the shelves, review the differences, then update stock in one step." />

      <Card title="Start a new count" subtitle="A snapshot of current stock is taken now. Sales made during the count are kept.">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Select label="Products" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All active products</option>
            {categories.filter((c) => c.status !== 'INACTIVE').map((c) => (
              <option key={c.categoryId} value={c.categoryId}>{c.name} only</option>
            ))}
          </Select>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} optional placeholder="e.g. Month-end count" />
          <Button icon={Plus} onClick={startCount} isLoading={busy === 'start'}>Start count</Button>
        </div>
      </Card>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          keyField="countId"
          isLoading={isLoading}
          data={counts}
          emptyMessage="No stock counts yet"
          onRowClick={(row) => openCount(row.countId)}
          columns={[
            { header: 'Count #', key: 'countNumber', render: (r) => <span className="font-mono font-semibold">{r.countNumber}</span> },
            { header: 'Started', key: 'createdAt', render: (r) => formatDate(r.createdAt) },
            { header: 'By', key: 'createdBy' },
            { header: 'Notes', key: 'notes' },
            {
              header: 'Status',
              key: 'status',
              render: (r) => (
                <Badge variant={r.status === 'APPLIED' ? 'success' : r.status === 'OPEN' ? 'warning' : 'neutral'} size="xs">{r.status}</Badge>
              ),
            },
            { header: 'Applied', key: 'appliedAt', render: (r) => (r.appliedAt ? `${formatDate(r.appliedAt)} · ${r.appliedBy}` : '—') },
          ]}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className={`text-lg font-semibold tabular ${tone}`}>{value}</p>
    </div>
  );
}
