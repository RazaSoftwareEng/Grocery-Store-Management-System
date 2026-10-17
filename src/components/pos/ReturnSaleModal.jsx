import React, { useEffect, useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { ManagerPinModal } from '../common/ManagerPinModal';
import { api } from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatNumber, isWeightedUnit, round2 } from '../../utils/formatters';

/**
 * Partial return: choose a quantity per line. Value is worked out by the
 * database (line price share of bill discount and tax); this is a preview.
 */
export function ReturnSaleModal({ sale, isOpen, onClose, onDone }) {
  const { currencySymbol } = useStore();
  const { showToast } = useToast();
  const [details, setDetails] = useState(null);
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approval, setApproval] = useState(null);

  useEffect(() => {
    if (!isOpen || !sale) return;
    setDetails(null);
    setQty({});
    setReason('');
    setRefundMethod('CASH');
    setError('');
    api.getSaleDetails(sale.saleId).then((res) => {
      if (res.success) setDetails(res.data);
      else showToast(res.error || 'Could not load the bill', 'error');
    });
  }, [isOpen, sale, showToast]);

  const items = details?.items || [];
  const s = details?.sale;
  const factor = s && Number(s.subtotal) > 0 ? Number(s.total) / Number(s.subtotal) : 0;
  const preview = round2(
    items.reduce((sum, i) => sum + (Number(qty[i.saleItemId]) || 0) * (Number(i.lineTotal) / Number(i.quantity || 1)) * factor, 0)
  );
  const khataLeft = s ? Math.max(0, Number(s.creditAmount) - Number(s.creditReturned)) : 0;
  const isWalkIn = !s || s.customerId === 'WALK-IN';

  const submit = async (approvalToken = null) => {
    const lines = items
      .map((i) => ({ saleItemId: i.saleItemId, qty: Number(qty[i.saleItemId]) || 0 }))
      .filter((l) => l.qty > 0);
    if (!lines.length) return setError('Enter a return quantity for at least one item');
    if (reason.trim().length < 3) return setError('Give a reason for the return');
    setIsSubmitting(true);
    const res = await api.returnSaleItems({ saleId: sale.saleId, items: lines, reason, refundMethod, approvalToken });
    setIsSubmitting(false);
    if (res.success) {
      const r = res.data;
      showToast(
        `Return saved: ${formatCurrency(r.total, currencySymbol)}` +
          (Number(r.refundAmount) > 0 ? `, give back ${formatCurrency(r.refundAmount, currencySymbol)} (${r.refundMethod})` : '') +
          (Number(r.creditAmount) > 0 ? `, khata reduced ${formatCurrency(r.creditAmount, currencySymbol)}` : ''),
        'success',
        7000
      );
      onDone?.(r);
      onClose();
    } else if (res.needsApproval) {
      setApproval({ reason: res.error });
    } else {
      setError(res.error || 'Return failed');
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Return items · ${sale?.invoiceNumber || ''}`}
        subtitle={s ? `${formatCurrency(s.total, currencySymbol)} · ${s.customerName}` : 'Loading…'}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Go back
            </Button>
            <Button variant="danger" icon={RotateCcw} isLoading={isSubmitting} onClick={() => submit()} disabled={!details}>
              Return {preview > 0 ? formatCurrency(preview, currencySymbol) : ''}
            </Button>
          </>
        }
      >
        {!details ? (
          <p className="text-sm text-slate-500">Loading bill…</p>
        ) : (
          <div className="space-y-4">
            <table className="w-full text-[13px]">
              <thead className="text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2">Sold</th>
                  <th className="text-right py-2">Returned</th>
                  <th className="text-right py-2 w-28">Return now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((i) => {
                  const left = round2(Number(i.quantity) - Number(i.returnedQty || 0));
                  return (
                    <tr key={i.saleItemId}>
                      <td className="py-2">
                        <p className="font-medium text-slate-900">{i.productName}</p>
                        <p className="text-xs text-slate-500 tabular">
                          {formatCurrency(i.unitPrice, currencySymbol)} / {i.unit}
                        </p>
                      </td>
                      <td className="text-right tabular">{formatNumber(i.quantity)}</td>
                      <td className="text-right tabular">{formatNumber(i.returnedQty || 0)}</td>
                      <td className="text-right">
                        <input
                          type="number"
                          min="0"
                          max={left}
                          step={isWeightedUnit(i.unit) ? 'any' : 1}
                          disabled={left <= 0}
                          value={qty[i.saleItemId] ?? ''}
                          onChange={(e) => {
                            const v = Math.min(left, Math.max(0, Number(e.target.value) || 0));
                            setQty((prev) => ({ ...prev, [i.saleItemId]: e.target.value === '' ? '' : v }));
                            setError('');
                          }}
                          placeholder={left > 0 ? `max ${formatNumber(left)}` : 'done'}
                          aria-label={`Return quantity for ${i.productName}`}
                          className="w-24 h-8 px-2 text-right tabular border border-slate-300 rounded-lg disabled:bg-slate-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {khataLeft > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[13px] text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  {formatCurrency(khataLeft, currencySymbol)} of this bill is still on khata. The return reduces the khata first;
                  only the rest is refunded.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Reason *"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError('');
                }}
                placeholder="e.g. damaged, expired"
              />
              <Select
                label="Refund as"
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                options={[
                  { value: 'CASH', label: 'Cash from drawer' },
                  { value: 'CARD', label: 'Card reversal' },
                  { value: 'ONLINE', label: 'Bank / online transfer' },
                  ...(isWalkIn ? [] : [{ value: 'CREDIT', label: 'Credit to customer khata' }]),
                ]}
              />
            </div>
            {error && <p role="alert" className="text-[13px] text-rose-700">{error}</p>}
          </div>
        )}
      </Modal>
      <ManagerPinModal
        isOpen={Boolean(approval)}
        reason={approval?.reason}
        onClose={() => setApproval(null)}
        onApproved={(token) => {
          setApproval(null);
          submit(token);
        }}
      />
    </>
  );
}
