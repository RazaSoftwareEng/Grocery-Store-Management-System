import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { formatCurrency } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Banknote, CreditCard, Smartphone, Clock, CheckCircle2 } from 'lucide-react';

export function PaymentModal({
  isOpen,
  onClose,
  onSaleComplete,
}) {
  const {
    cart,
    cartSubtotal,
    cartTax,
    cartDiscount,
    cartTotal,
    activeCustomer,
    cashier,
    currencySymbol,
    clearCart,
    refreshAllData,
  } = useStore();

  const { showToast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize amountPaid with cartTotal whenever modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setAmountPaid(String(cartTotal));
    }
  }, [isOpen, cartTotal]);

  const tendered = parseFloat(amountPaid) || 0;
  const change = Math.max(0, tendered - cartTotal);
  const remaining = Math.max(0, cartTotal - tendered);

  const handleQuickCash = (extra) => {
    if (extra === 'EXACT') {
      setAmountPaid(String(cartTotal));
    } else {
      const current = parseFloat(amountPaid) || 0;
      setAmountPaid(String(current + extra));
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (!cart.length) {
      showToast('Cart is empty', 'warning');
      return;
    }

    if (paymentMethod === 'CASH' && tendered < cartTotal) {
      showToast(`Tendered cash (${tendered}) is less than total (${cartTotal})`, 'warning');
      return;
    }

    if (paymentMethod === 'CREDIT' && (!activeCustomer || activeCustomer.customerId === 'WALK-IN')) {
      showToast('Please select a registered customer to process a Credit sale', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);

      const salePayload = {
        items: cart,
        customerId: activeCustomer?.customerId || 'WALK-IN',
        customerName: activeCustomer?.name || 'Walk-in Customer',
        subtotal: cartSubtotal,
        discount: cartDiscount,
        tax: cartTax,
        total: cartTotal,
        amountPaid: paymentMethod === 'CREDIT' ? 0 : tendered,
        change: paymentMethod === 'CASH' ? change : 0,
        paymentMethod: paymentMethod,
        cashierId: cashier.id,
        cashierName: cashier.name,
        notes: (notes ? notes + ' ' : '') + (reference ? `Ref: ${reference}` : ''),
      };

      const res = await api.createSale(salePayload);

      if (res?.success) {
        showToast('Sale completed successfully!', 'success');
        clearCart();
        await refreshAllData();
        onClose();
        onSaleComplete(res.data);
      } else {
        showToast(res?.error || 'Failed to process sale', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error processing transaction', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Transaction"
      subtitle={`Customer: ${activeCustomer?.name || 'Walk-in'} • Cashier: ${cashier.name}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleCheckout} className="space-y-5">
        {/* Total Summary Header */}
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Amount Due
            </p>
            <p className="text-2xl font-black text-emerald-950 mt-0.5">
              {formatCurrency(cartTotal, currencySymbol)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Subtotal: {formatCurrency(cartSubtotal, currencySymbol)}</p>
            {cartDiscount > 0 && (
              <p className="text-rose-600 font-medium">
                Discount: -{formatCurrency(cartDiscount, currencySymbol)}
              </p>
            )}
            {cartTax > 0 && <p>Tax: {formatCurrency(cartTax, currencySymbol)}</p>}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-2">
            Select Payment Method
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'CASH', label: 'Cash', icon: Banknote },
              { id: 'CARD', label: 'Card', icon: CreditCard },
              { id: 'ONLINE', label: 'Transfer', icon: Smartphone },
              { id: 'CREDIT', label: 'Store Credit', icon: Clock },
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cash Tendered & Quick Buttons */}
        {paymentMethod === 'CASH' && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <Input
              label="Cash Received (Tendered) *"
              type="number"
              step="any"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              required
              autoFocus
            />

            {/* Quick Denominations in PKR */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                Quick Cash Add (PKR)
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickCash('EXACT')}
                >
                  Exact
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickCash(100)}>
                  +100
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickCash(500)}>
                  +500
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickCash(1000)}>
                  +1,000
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickCash(5000)}>
                  +5,000
                </Button>
              </div>
            </div>

            {/* Change calculation */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-600">Change to Return:</span>
              <span
                className={`text-lg font-black ${
                  tendered >= cartTotal ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {tendered >= cartTotal
                  ? formatCurrency(change, currencySymbol)
                  : `Short by ${formatCurrency(remaining, currencySymbol)}`}
              </span>
            </div>
          </div>
        )}

        {/* Card or Online Reference */}
        {(paymentMethod === 'CARD' || paymentMethod === 'ONLINE') && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <Input
              label="Transaction / Terminal Reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Card Approval # / Raast / EasyPaisa ID"
              autoFocus
            />
          </div>
        )}

        {/* Customer Credit Notice */}
        {paymentMethod === 'CREDIT' && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <p className="font-bold">Store Credit Sale (Khata)</p>
            <p>
              This invoice amount of <strong>{formatCurrency(cartTotal, currencySymbol)}</strong> will be added to{' '}
              <strong>{activeCustomer?.name}</strong>'s outstanding balance.
            </p>
            <p className="text-[11px] text-amber-700">
              Current balance: {formatCurrency(activeCustomer?.outstandingBalance || 0, currencySymbol)}
            </p>
          </div>
        )}

        {/* Transaction Notes */}
        <Input
          label="Optional Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Special packing, delivery instructions"
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            icon={CheckCircle2}
            className="px-6 font-bold"
          >
            Confirm & Pay {formatCurrency(cartTotal, currencySymbol)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
