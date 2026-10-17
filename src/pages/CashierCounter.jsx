import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { ReturnSaleModal } from '../components/pos/ReturnSaleModal';
import { OpenShiftPanel } from '../components/pos/OpenShiftPanel';
import { ZReport } from '../components/pos/ZReport';
import { formatCurrency, formatTime } from '../utils/formatters';
import { ShoppingCart, Receipt, Banknote, CreditCard, BookUser, Printer, RefreshCw, Keyboard, RotateCcw, LockKeyhole } from 'lucide-react';

const PAYMENT_LABELS = { CASH: 'Cash', CARD: 'Card', ONLINE: 'Online', BANK_TRANSFER: 'Bank', CREDIT: 'Udhaar', SPLIT: 'Split' };

export function CashierCounter() {
  const { currentUser } = useAuth();
  const { currencySymbol, currentShift, refreshShift } = useStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [receiptData, setReceiptData] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [returnSale, setReturnSale] = useState(null);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeError, setCloseError] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [closedSummary, setClosedSummary] = useState(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    const [res] = await Promise.all([api.getCashierSummary(currentUser?.userId), refreshShift()]);
    if (res.success) setSummary(res.data);
    else showToast(res.error || 'Could not load your bills', 'error');
    setIsLoading(false);
  }, [currentUser?.userId, showToast, refreshShift]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleReprint = async (sale) => {
    const res = await api.getSaleDetails(sale.saleId);
    if (res.success) {
      setReceiptData(res.data);
      setIsReceiptOpen(true);
    } else {
      showToast(res.error || 'Could not load bill', 'error');
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    const n = Number(countedCash);
    if (countedCash.trim() === '' || Number.isNaN(n) || n < 0) {
      setCloseError('Count the cash in the drawer and enter the total');
      return;
    }
    setIsClosing(true);
    const res = await api.closeShift({ shiftId: currentShift?.shiftId, countedCash: n, notes: closeNotes });
    setIsClosing(false);
    if (res.success) {
      setClosedSummary(res.data);
      setIsCloseOpen(false);
      setCountedCash('');
      setCloseNotes('');
      refreshShift();
      showToast('Shift closed', 'success');
    } else {
      setCloseError(res.error || 'Could not close the shift');
    }
  };

  const shift = currentShift;
  const cards = [
    { title: 'My sales this shift', value: formatCurrency(shift?.salesTotal, currencySymbol), subtitle: `${shift?.billCount || 0} bills`, icon: Receipt },
    { title: 'Expected cash in drawer', value: formatCurrency(shift?.expectedCash, currencySymbol), subtitle: `Opening ${formatCurrency(shift?.openingCash, currencySymbol)}`, icon: Banknote },
    { title: 'Card / Online', value: formatCurrency((Number(shift?.cardSales) || 0) + (Number(shift?.onlineSales) || 0), currencySymbol), subtitle: 'Card, online & bank', icon: CreditCard },
    { title: 'Udhaar (Credit)', value: formatCurrency(shift?.creditSales, currencySymbol), subtitle: 'Added to customer khata', icon: BookUser },
  ];

  const columns = [
    { header: 'Invoice', key: 'invoiceNumber', render: (row) => <span className="font-mono font-semibold text-slate-900">{row.invoiceNumber}</span> },
    { header: 'Time', key: 'date', render: (row) => formatTime(row.date || row.createdAt) },
    { header: 'Customer', key: 'customerName' },
    { header: 'Payment', key: 'paymentMethod', render: (row) => PAYMENT_LABELS[row.paymentMethod] || row.paymentMethod },
    {
      header: 'Total',
      key: 'total',
      className: 'text-right font-semibold text-slate-900',
      headerClassName: 'text-right',
      render: (row) => formatCurrency(row.total, currencySymbol),
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <Badge variant={row.status !== 'COMPLETED' ? 'danger' : Number(row.returnedTotal) > 0 ? 'warning' : 'success'} size="xs">
          {row.status !== 'COMPLETED' ? 'Cancelled' : Number(row.returnedTotal) > 0 ? 'Part returned' : 'Paid'}
        </Badge>
      ),
    },
    {
      header: '',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" size="sm" icon={Printer} onClick={() => handleReprint(row)}>
            Reprint
          </Button>
          {row.status === 'COMPLETED' && Number(row.returnedTotal) < Number(row.total) && (
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setReturnSale(row)} title="Return items (manager PIN if needed)">
              Return
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 animate-rise">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {currentUser?.fullName || currentUser?.username}'s counter
            </h1>
            <p className="text-[13px] text-slate-500 mt-1">
              {shift ? `Shift open since ${formatTime(shift.openedAt)}` : 'No shift open'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {shift && (
              <Button variant="secondary" size="lg" icon={LockKeyhole} onClick={() => { setCloseError(''); setIsCloseOpen(true); }}>
                Close shift
              </Button>
            )}
            <Button variant="primary" size="lg" icon={ShoppingCart} onClick={() => navigate('/pos')} disabled={!shift} className="shrink-0">
              Start new bill
            </Button>
          </div>
        </div>
      </div>

      {shift === null && <OpenShiftPanel compact />}

      {closedSummary && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-slate-900">Last closed shift</h3>
            <Button variant="ghost" size="sm" onClick={() => setClosedSummary(null)}>Hide</Button>
          </div>
          <ZReport summary={closedSummary} />
        </div>
      )}

      {shift && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 shadow-xs">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-50 border border-slate-200 text-slate-500">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-500">{card.title}</p>
                  <p className="text-lg font-semibold text-slate-900 tabular truncate">{card.value}</p>
                  <p className="text-xs text-slate-400">{card.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">My bills today</h3>
            <p className="text-xs text-slate-500">
              Reprint a bill (marked DUPLICATE COPY) or return items
              {summary?.cancelledCount ? ` • ${summary.cancelledCount} cancelled by manager` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadSummary} isLoading={isLoading}>
            Refresh
          </Button>
        </div>
        <Table
          columns={columns}
          data={summary?.sales || []}
          isLoading={isLoading && !summary}
          keyField="saleId"
          emptyMessage="No bills yet today"
          emptyDescription="Your bills will show up here as you complete sales."
        />
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Keyboard className="w-3.5 h-3.5" />
        Shortcuts: F2 search · Enter add item · F8 pay · F4 clear bill
      </p>

      <ReceiptModal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} saleData={receiptData} isReprint />
      <ReturnSaleModal sale={returnSale} isOpen={Boolean(returnSale)} onClose={() => setReturnSale(null)} onDone={loadSummary} />

      <Modal
        isOpen={isCloseOpen}
        onClose={() => setIsCloseOpen(false)}
        title="Close shift"
        subtitle="Count all cash in the drawer, then enter the total."
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCloseOpen(false)} disabled={isClosing}>Cancel</Button>
            <Button type="submit" form="close-shift-form" icon={LockKeyhole} isLoading={isClosing}>Close shift</Button>
          </>
        }
      >
        <form id="close-shift-form" onSubmit={handleCloseShift} noValidate className="space-y-4">
          <ZReport summary={shift} title="Shift so far" />
          <Input
            label="Counted cash *"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={countedCash}
            onChange={(e) => { setCountedCash(e.target.value); setCloseError(''); }}
            suffix={currencySymbol}
            error={closeError}
            hint={countedCash !== '' && !Number.isNaN(Number(countedCash))
              ? `Difference: ${formatCurrency(Number(countedCash) - (Number(shift?.expectedCash) || 0), currencySymbol)}`
              : undefined}
            className="tabular text-base font-semibold"
            autoFocus
          />
          <Input label="Notes" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} optional placeholder="e.g. 500 note given to manager" />
        </form>
      </Modal>
    </div>
  );
}
