import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, FieldLabel, FieldMessage } from '../common/Input';
import { formatCurrency } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import { api } from '../../services/api';
import { Banknote, CreditCard, Smartphone, Clock, CheckCircle2 } from 'lucide-react';

const METHODS = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'ONLINE', label: 'Transfer', icon: Smartphone },
  { id: 'CREDIT', label: 'Khata', icon: Clock },
];

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

  const isWalkIn = !activeCustomer || activeCustomer.customerId === 'WALK-IN';

  const v = useFormValidation(
    { paymentMethod, amountPaid },
    {
      paymentMethod: (val) =>
        val === 'CREDIT' && isWalkIn ? 'Khata needs a registered customer. Select one from the bill first.' : '',
      amountPaid: (val, all) => {
        if (all.paymentMethod !== 'CASH') return '';
        if (String(val).trim() === '') return 'Enter the cash received';
        const n = Number(val);
        if (Number.isNaN(n)) return 'Numbers only';
        if (n < cartTotal) return `Short by ${formatCurrency(cartTotal - n, currencySymbol)}`;
        return '';
      },
    }
  );

  // Initialize amountPaid with cartTotal whenever modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setAmountPaid(String(cartTotal));
      v.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cartTotal]);

  const tendered = parseFloat(amountPaid) || 0;
  const change = Math.max(0, tendered - cartTotal);

  const creditLimit = Number(activeCustomer?.creditLimit) || 0;
  const newBalance = (Number(activeCustomer?.outstandingBalance) || 0) + cartTotal;
  const overLimit = paymentMethod === 'CREDIT' && !isWalkIn && creditLimit > 0 && newBalance > creditLimit;

  const handleQuickCash = (extra) => {
    if (extra === 'EXACT') {
      setAmountPaid(String(cartTotal));
    } else {
      const current = parseFloat(amountPaid) || 0;
      setAmountPaid(String(current + extra));
    }
    v.touch('amountPaid');
  };

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (!cart.length) {
      showToast('The bill is empty. Add products first.', 'warning');
      return;
    }
    if (!v.validate()) return;

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
        showToast(`Payment of ${formatCurrency(cartTotal, currencySymbol)} received`, 'success');
        clearCart();
        await refreshAllData();
        onClose();
        onSaleComplete(res.data);
      } else {
        showToast(res?.error || 'Failed to process sale', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Could not complete the sale. Try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const methodError = v.errorFor('paymentMethod');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Take payment"
      subtitle={`${activeCustomer?.name || 'Walk-in customer'} · Cashier: ${cashier.name}`}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" variant="primary" size="lg" isLoading={isSubmitting} icon={CheckCircle2}>
            Charge {formatCurrency(cartTotal, currencySymbol)}
          </Button>
        </>
      }
    >
      <form id="payment-form" ref={v.formRef} onSubmit={handleCheckout} noValidate className="space-y-5">
        {/* Amount due */}
        <div className="flex items-end justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-[13px] text-slate-500">Amount due</p>
            <p className="text-3xl font-semibold text-slate-900 tabular tracking-tight mt-0.5">
              {formatCurrency(cartTotal, currencySymbol)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-0.5 tabular">
            <p>Subtotal {formatCurrency(cartSubtotal, currencySymbol)}</p>
            {cartDiscount > 0 && <p className="text-rose-600">Discount −{formatCurrency(cartDiscount, currencySymbol)}</p>}
            {cartTax > 0 && <p>Tax {formatCurrency(cartTax, currencySymbol)}</p>}
          </div>
        </div>

        {/* Method */}
        <div className="flex flex-col gap-1.5" data-field="paymentMethod">
          <FieldLabel label="Payment method" />
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  name={m.id === 'CREDIT' ? 'paymentMethod' : undefined}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setPaymentMethod(m.id);
                    v.touch('paymentMethod');
                  }}
                  className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[13px] font-medium transition-all duration-150 ${
                    isSelected
                      ? methodError && m.id === 'CREDIT'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 ring-[3px] ring-rose-600/15'
                        : 'border-brand-600 bg-brand-50 text-brand-700 ring-[3px] ring-brand-600/15'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  {m.label}
                </button>
              );
            })}
          </div>
          <FieldMessage error={methodError} />
        </div>

        {paymentMethod === 'CASH' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
            <Input
              label="Cash received *"
              type="number"
              inputMode="decimal"
              step="any"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              suffix={currencySymbol}
              className="text-base font-semibold tabular h-11"
              autoFocus
              {...v.field('amountPaid')}
              isValid={false}
            />

            <div className="flex flex-wrap gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => handleQuickCash('EXACT')}>
                Exact
              </Button>
              {[100, 500, 1000, 5000].map((n) => (
                <Button key={n} variant="secondary" size="sm" onClick={() => handleQuickCash(n)} className="tabular">
                  +{n.toLocaleString()}
                </Button>
              ))}
            </div>

            <div
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors duration-200 ${
                tendered >= cartTotal ? 'bg-brand-50 border-brand-100' : 'bg-slate-50 border-slate-200'
              }`}
              aria-live="polite"
            >
              <span className="text-[13px] text-slate-600">Change to return</span>
              <span
                key={change}
                className={`text-xl font-semibold tabular animate-bump inline-block ${
                  tendered >= cartTotal ? 'text-brand-700' : 'text-slate-400'
                }`}
              >
                {formatCurrency(change, currencySymbol)}
              </span>
            </div>
          </div>
        )}

        {(paymentMethod === 'CARD' || paymentMethod === 'ONLINE') && (
          <div className="animate-in fade-in slide-in-from-top-1">
            <Input
              label="Transaction reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Approval #, Raast or EasyPaisa ID"
              optional
              autoFocus
            />
          </div>
        )}

        {paymentMethod === 'CREDIT' && !isWalkIn && (
          <div
            className={`p-4 rounded-xl border text-[13px] space-y-1 animate-in fade-in slide-in-from-top-1 ${
              overLimit ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <p className="font-semibold">Added to {activeCustomer?.name}'s khata</p>
            <p className="tabular">
              Balance goes from {formatCurrency(activeCustomer?.outstandingBalance || 0, currencySymbol)} to{' '}
              <strong>{formatCurrency(newBalance, currencySymbol)}</strong>
              {creditLimit > 0 && <> (limit {formatCurrency(creditLimit, currencySymbol)})</>}.
            </p>
            {overLimit && <p className="font-medium">This sale goes over the customer's credit limit.</p>}
          </div>
        )}

        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Deliver to shop #12"
          optional
        />
      </form>
    </Modal>
  );
}
