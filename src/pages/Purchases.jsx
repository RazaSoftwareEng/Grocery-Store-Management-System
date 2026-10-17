import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency, formatDate, formatNumber, round2 } from '../utils/formatters';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { PurchaseModal } from '../components/purchases/PurchaseModal';
import { Plus, RefreshCw, Eye, Truck, PackageCheck, Edit, Ban, Undo2, DollarSign } from 'lucide-react';

const PAGE_SIZE = 15;
const STATUS_VARIANT = { DRAFT: 'neutral', ORDERED: 'info', PARTIALLY_RECEIVED: 'warning', RECEIVED: 'success', CANCELLED: 'danger' };

export function Purchases() {
  const { currencySymbol, refreshProducts } = useStore();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const f = (n) => formatCurrency(n, currencySymbol);

  const [purchases, setPurchases] = useState([]);
  const [count, setCount] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [lineAction, setLineAction] = useState(null); // { type: 'receive'|'return', purchase }
  const [lineQty, setLineQty] = useState({});
  const [actionReason, setActionReason] = useState('');
  const [paying, setPaying] = useState(null);
  const [pay, setPay] = useState({ amount: '', method: 'CASH', reference: '' });
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [purRes, suppRes] = await Promise.all([
      api.getPurchases({ status: statusFilter, page: currentPage, pageSize: PAGE_SIZE }),
      api.getSuppliers(),
    ]);
    setIsLoading(false);
    if (purRes.success) {
      setPurchases(purRes.data);
      setCount(purRes.count);
    } else showToast(purRes.error, 'error');
    if (suppRes.success) setSuppliers(suppRes.data.filter((s) => s.status !== 'INACTIVE'));
  }, [statusFilter, currentPage, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // "Create PO" from low-stock products
  useEffect(() => {
    if (location.state?.reorder?.length) {
      setPrefill(location.state.reorder);
      setEditing(null);
      setIsModalOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const openLineAction = (type, purchase) => {
    const due = (i) => (type === 'receive' ? Number(i.quantity) - Number(i.receivedQty) : Number(i.receivedQty) - Number(i.returnedQty));
    setLineQty(Object.fromEntries((purchase.items || []).map((i) => [i.purchaseItemId, type === 'receive' ? String(round2(due(i))) : ''])));
    setActionReason('');
    setLineAction({ type, purchase, due });
  };

  const submitLineAction = async () => {
    const items = Object.entries(lineQty)
      .map(([purchaseItemId, qty]) => ({ purchaseItemId, qty: Number(qty) || 0 }))
      .filter((i) => i.qty > 0);
    if (!items.length) return showToast('Enter a quantity for at least one item', 'warning');
    setBusy(true);
    const { type, purchase } = lineAction;
    const res = type === 'receive'
      ? await api.receivePurchase(purchase.purchaseId, items)
      : await api.returnPurchase(purchase.purchaseId, items, actionReason);
    setBusy(false);
    if (res.success) {
      showToast(res.message, 'success');
      setLineAction(null);
      refreshProducts();
      loadData();
    } else showToast(res.error, 'error');
  };

  const submitPay = async (e) => {
    e.preventDefault();
    if (!(Number(pay.amount) > 0)) return showToast('Enter an amount', 'warning');
    setBusy(true);
    const res = await api.recordSupplierPayment({ supplierId: paying.supplierId, purchaseId: paying.purchaseId, ...pay });
    setBusy(false);
    if (res.success) {
      showToast(res.message, 'success');
      setPaying(null);
      loadData();
    } else showToast(res.error, 'error');
  };

  const submitCancel = async () => {
    setBusy(true);
    const res = await api.cancelPurchase(cancelling.purchaseId, actionReason);
    setBusy(false);
    if (res.success) {
      showToast(res.message, 'success');
      setCancelling(null);
      loadData();
    } else showToast(res.error, 'error');
  };

  const columns = [
    {
      header: 'PO #',
      key: 'purchaseNumber',
      render: (r) => (
        <div>
          <span className="font-mono font-semibold text-slate-900">{r.purchaseNumber}</span>
          <p className="text-xs text-slate-500">{formatDate(r.date)}</p>
        </div>
      ),
    },
    { header: 'Supplier', key: 'supplierName', render: (r) => <span className="font-medium">{r.supplierName}</span> },
    {
      header: 'Total',
      key: 'total',
      render: (r) => (
        <div className="tabular text-[13px]">
          <span className="font-semibold">{f(r.total)}</span>
          {Number(r.receivedTotal) > 0 && Number(r.receivedTotal) < Number(r.total) && <p className="text-xs text-slate-500">received {f(r.receivedTotal)}</p>}
          {Number(r.returnedTotal) > 0 && <p className="text-xs text-rose-600">returned {f(r.returnedTotal)}</p>}
        </div>
      ),
    },
    { header: 'Paid', key: 'amountPaid', render: (r) => <span className="tabular text-[13px]">{f(r.amountPaid)}</span> },
    { header: 'Due', key: 'outstandingBalance', render: (r) => <span className="tabular text-[13px] font-semibold text-amber-700">{f(r.outstandingBalance)}</span> },
    { header: 'Status', key: 'status', render: (r) => <Badge variant={STATUS_VARIANT[r.status] || 'neutral'} size="xs">{r.status}</Badge> },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (r) => {
        const open = ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(r.status);
        const untouched = ['DRAFT', 'ORDERED'].includes(r.status) && !(r.items || []).some((i) => Number(i.receivedQty) > 0);
        const canReturn = (r.items || []).some((i) => Number(i.receivedQty) > Number(i.returnedQty));
        return (
          <div className="flex justify-end gap-1 flex-wrap">
            <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(r)} aria-label="View" />
            {open && <Button size="sm" icon={PackageCheck} onClick={() => openLineAction('receive', r)}>Receive</Button>}
            {untouched && <Button size="sm" variant="ghost" icon={Edit} onClick={() => { setEditing(r); setPrefill(null); setIsModalOpen(true); }} aria-label="Edit" />}
            {r.status !== 'CANCELLED' && Number(r.outstandingBalance) > 0 && (
              <Button size="sm" variant="secondary" icon={DollarSign} onClick={() => { setPaying(r); setPay({ amount: String(r.outstandingBalance), method: 'CASH', reference: '' }); }}>Pay</Button>
            )}
            {canReturn && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => openLineAction('return', r)} title="Return to supplier" />}
            {untouched && <Button size="sm" variant="ghost" icon={Ban} onClick={() => { setCancelling(r); setActionReason(''); }} title="Cancel order" className="text-slate-400 hover:text-rose-600" />}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Purchases</h2>
          <p className="text-sm text-slate-500 mt-0.5">Order stock, receive full or partial deliveries, return goods and pay suppliers.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} aria-label="Status"
            className="h-[38px] px-3 text-[13px] bg-white border border-slate-300 rounded-xl">
            <option value="">All statuses</option>
            {Object.keys(STATUS_VARIANT).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <Button variant="ghost" icon={RefreshCw} onClick={loadData}>Refresh</Button>
          <Button icon={Plus} onClick={() => { setEditing(null); setPrefill(null); setIsModalOpen(true); }} disabled={!suppliers.length}>New order</Button>
        </div>
      </div>
      {!suppliers.length && !isLoading && (
        <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <Truck className="w-4 h-4" /> Add a supplier first on the Suppliers page.
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table columns={columns} data={purchases} isLoading={isLoading} keyField="purchaseId" emptyMessage="No purchase orders yet" />
        <Pagination currentPage={currentPage} totalPages={Math.ceil(count / PAGE_SIZE) || 1} totalItems={count} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      </div>

      <PurchaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        suppliers={suppliers}
        editing={editing}
        prefillItems={prefill}
        onSuccess={loadData}
      />

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.purchaseNumber} subtitle={viewing ? `${viewing.supplierName} · ${viewing.status}` : ''} maxWidth="max-w-2xl">
        {viewing && (
          <table className="w-full text-[13px]">
            <thead className="text-xs text-slate-500 border-b border-slate-200">
              <tr><th className="text-left py-2">Item</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">Returned</th><th className="text-right">Cost</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(viewing.items || []).map((i) => (
                <tr key={i.purchaseItemId}>
                  <td className="py-2">{i.productName}</td>
                  <td className="text-right tabular">{formatNumber(i.quantity)}</td>
                  <td className="text-right tabular">{formatNumber(i.receivedQty)}</td>
                  <td className="text-right tabular">{formatNumber(i.returnedQty)}</td>
                  <td className="text-right tabular">{f(i.unitCost)}</td>
                  <td className="text-right tabular">{f(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {viewing?.notes && <p className="text-xs text-slate-500 mt-3">Notes: {viewing.notes}</p>}
      </Modal>

      <Modal
        isOpen={Boolean(lineAction)}
        onClose={() => setLineAction(null)}
        title={lineAction?.type === 'receive' ? `Receive ${lineAction?.purchase.purchaseNumber}` : `Return to supplier · ${lineAction?.purchase.purchaseNumber}`}
        subtitle={lineAction?.type === 'receive' ? 'Enter what actually arrived. The rest stays due.' : 'Stock goes out and the supplier balance is reduced.'}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLineAction(null)}>Cancel</Button>
            <Button onClick={submitLineAction} isLoading={busy} variant={lineAction?.type === 'return' ? 'danger' : 'primary'}>
              {lineAction?.type === 'receive' ? 'Add to stock' : 'Return goods'}
            </Button>
          </>
        }
      >
        {lineAction && (
          <div className="space-y-3">
            <table className="w-full text-[13px]">
              <thead className="text-xs text-slate-500 border-b border-slate-200">
                <tr><th className="text-left py-2">Item</th><th className="text-right">{lineAction.type === 'receive' ? 'Still due' : 'Can return'}</th><th className="text-right w-32">Quantity</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(lineAction.purchase.items || []).map((i) => {
                  const due = round2(lineAction.due(i));
                  return (
                    <tr key={i.purchaseItemId}>
                      <td className="py-2">{i.productName}</td>
                      <td className="text-right tabular">{formatNumber(due)}</td>
                      <td className="text-right">
                        <input type="number" min="0" max={due} step="any" disabled={due <= 0} value={lineQty[i.purchaseItemId] ?? ''}
                          onChange={(e) => setLineQty((p) => ({ ...p, [i.purchaseItemId]: e.target.value }))}
                          aria-label={`Quantity of ${i.productName}`}
                          className="w-28 h-8 px-2 text-right tabular border border-slate-300 rounded-lg disabled:bg-slate-100" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lineAction.type === 'receive' && <p className="text-xs text-slate-500">Product cost is updated with a weighted average of old stock and this delivery.</p>}
            {lineAction.type === 'return' && <Input label="Reason" value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="e.g. Damaged cartons" />}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(paying)}
        onClose={() => setPaying(null)}
        title={`Pay supplier · ${paying?.purchaseNumber || ''}`}
        subtitle={paying ? `${paying.supplierName} · due ${f(paying.outstandingBalance)}` : ''}
        maxWidth="max-w-sm"
        footer={<Button type="submit" form="po-pay-form" isLoading={busy} icon={DollarSign}>Record payment</Button>}
      >
        <form id="po-pay-form" onSubmit={submitPay} className="space-y-3">
          <Input label="Amount *" type="number" min="0" step="any" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} suffix={currencySymbol} autoFocus />
          <Select label="Method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}
            options={[{ value: 'CASH', label: 'Cash' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'CHEQUE', label: 'Cheque' }, { value: 'ONLINE', label: 'Online' }]} />
          <Input label="Reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} optional />
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={`Cancel ${cancelling?.purchaseNumber || ''}?`}
        maxWidth="max-w-sm"
        footer={<Button variant="danger" onClick={submitCancel} isLoading={busy} icon={Ban}>Cancel order</Button>}
      >
        <div className="space-y-3">
          <p className="text-[13px] text-slate-600">Nothing has been received on this order. Any amount already paid stays as an advance with the supplier.</p>
          <Input label="Reason" value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
