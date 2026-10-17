import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, FieldLabel } from '../common/Input';
import { ManagerPinModal } from '../common/ManagerPinModal';
import { formatCurrency, round2 } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Banknote, CreditCard, Smartphone, Clock, CheckCircle2, Plus, X } from 'lucide-react';

const METHODS = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'ONLINE', label: 'Transfer', icon: Smartphone },
  { id: 'CREDIT', label: 'Khata', icon: Clock },
];

/**
 * Payment with one or more tenders (cash + card + transfer + khata).
 * Totals shown here are a preview; the database recomputes every price.
 */
export function PaymentModal({ isOpen, onClose, onSaleComplete }) {
  const {
    cart,
    cartSubtotal,
    cartTax,
    cartDiscount,
    cartTotal,
    cartDiscountPercent,
    activeCustomer,
    currencySymbol,
    clearCart,
    refreshProducts,
    refreshShift,
  } = useStore();
  const { currentUser, permissions } = useAuth();
  const { showToast } = useToast();

  const [tenders, setTenders] = useState([{ method: 'CASH', amount: '', reference: '' }]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approval, setApproval] = useState(null); // { reason }
  const [submitted, setSubmitted] = useState(false);

  const isWalkIn = !activeCustomer || activeCustomer.customerId === 'WALK-IN';

  useEffect(() => {
    if (isOpen) {
      setTenders([{ method: 'CASH', amount: String(cartTotal), reference: '' }]);
      setNotes('');
      setSubmitted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const amt = (t) => (t.method === 'CREDIT' ? 0 : Math.max(0, parseFloat(t.amount) || 0));
  const cash = tenders.filter((t) => t.method === 'CASH').reduce((s, t) => s + amt(t), 0);
  const nonCash = tenders.filter((t) => t.method === 'CARD' || t.method === 'ONLINE').reduce((s, t) => s + amt(t), 0);
  const hasCredit = tenders.some((t) => t.method === 'CREDIT');
  const paidNow = round2(cash + nonCash);
  const toKhata = hasCredit ? round2(Math.max(0, cartTotal - paidNow)) : 0;
  const change = round2(Math.max(0, cash - Math.max(0, cartTotal - nonCash)));
  const short = !hasCredit ? round2(Math.max(0, cartTotal - paidNow)) : 0;

  const creditLimit = Number(activeCustomer?.creditLimit) || 0;
  const currentBalance = Number(activeCustomer?.outstandingBalance) || 0;
  const newBalance = round2(currentBalance + toKhata);
  const overLimit = toKhata > 0 && creditLimit > 0 && newBalance > creditLimit;
  const overDiscount = cartDiscountPercent > (Number(permissions.maxDiscountPercent) || 0) + 0.001;

  let error = '';
  if (hasCredit && isWalkIn) error = 'Khata needs a registered customer. Select one from the bill first.';
  else if (nonCash > cartTotal) error = 'Card / transfer cannot be more than the bill. Only cash gives change.';
  else if (short > 0) error = `Short by ${formatCurrency(short, currencySymbol)}`;

  const updateTender = (idx, patch) => setTenders((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));

  const setSingleMethod = (method) => {
    setTenders([{ method, amount: method === 'CREDIT' ? '' : String(cartTotal), reference: '' }]);
  };

  const addTender = () => {
    const used = new Set(tenders.map((t) => t.method));
    const method = ['CARD', 'ONLINE', 'CREDIT', 'CASH'].find((m) => !used.has(m));
    if (!method) return;
    const remaining = round2(Math.max(0, cartTotal - paidNow));
    setTenders((prev) => [...prev, { method, amount: method === 'CREDIT' ? '' : String(remaining), reference: '' }]);
  };

  const handleQuickCash = (extra) => {
    const idx = tenders.findIndex((t) => t.method === 'CASH');
    if (idx < 0) return;
    if (extra === 'EXACT') updateTender(idx, { amount: String(round2(Math.max(0, cartTotal - nonCash))) });
    else updateTender(idx, { amount: String((parseFloat(tenders[idx].amount) || 0) + extra) });
  };

  const submitSale = async (approvalToken = null) => {
    try {
      setIsSubmitting(true);
      const res = await api.createSale({
        customerId: activeCustomer?.customerId || 'WALK-IN',
        items: cart,
        discount: cartDiscount,
        payments: tenders
          .filter((t) => t.method === 'CREDIT' || amt(t) > 0)
          .map((t) => ({ method: t.method, amount: amt(t), reference: t.reference })),
        notes,
        approvalToken,
      });

      if (res?.success) {
        showToast(`Sale ${res.data.sale.invoiceNumber} saved`, 'success');
        clearCart();
        onClose();
        onSaleComplete(res.data);
        refreshProducts();
        refreshShift();
      } else if (res?.needsApproval) {
        setApproval({ reason: res.error });
      } else {
        showToast(res?.error || 'Failed to process sale', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Could not complete the sale. Try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!cart.length) {
      showToast('The bill is empty. Add products first.', 'warning');
      return;
    }
    if (error) return;
    submitSale();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Take payment"
        subtitle={`${activeCustomer?.name || 'Walk-in customer'} · Cashier: ${currentUser?.fullName || currentUser?.username || ''}`}
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
        <form id="payment-form" onSubmit={handleCheckout} noValidate className="space-y-5">
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

          {overDiscount && (
            <p className="text-[13px] px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              Discount is {cartDiscountPercent.toFixed(1)}%, over your limit of {permissions.maxDiscountPercent}%. A manager PIN
              will be asked.
            </p>
          )}

          {/* Quick single method */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel label="Pay with" />
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const isSelected = tenders.length === 1 && tenders[0].method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSingleMethod(m.id)}
                    className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[13px] font-medium transition-all duration-150 ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50 text-brand-700 ring-[3px] ring-brand-600/15'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tender lines */}
          <div className="space-y-2">
            {tenders.map((t, idx) => (
              <div key={idx} className="flex items-start gap-2 animate-in fade-in">
                <select
                  value={t.method}
                  onChange={(e) => updateTender(idx, { method: e.target.value, amount: e.target.value === 'CREDIT' ? '' : t.amount })}
                  aria-label="Tender method"
                  className="h-[38px] w-28 px-2 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  {METHODS.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id !== t.method && tenders.some((o) => o.method === m.id)}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {t.method === 'CREDIT' ? (
                  <div className="flex-1 h-[38px] px-3 flex items-center text-sm rounded-xl bg-amber-50 border border-amber-200 text-amber-900 tabular">
                    Rest to khata: {formatCurrency(toKhata, currencySymbol)}
                  </div>
                ) : (
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={t.amount}
                    onChange={(e) => updateTender(idx, { amount: e.target.value })}
                    placeholder="0.00"
                    suffix={currencySymbol}
                    containerClassName="flex-1"
                    className="tabular font-semibold"
                    aria-label={`${t.method} amount`}
                    autoFocus={idx === 0}
                  />
                )}
                {(t.method === 'CARD' || t.method === 'ONLINE') && (
                  <Input
                    value={t.reference}
                    onChange={(e) => updateTender(idx, { reference: e.target.value })}
                    placeholder="Ref #"
                    containerClassName="w-28"
                    aria-label="Reference"
                  />
                )}
                {tenders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTenders((prev) => prev.filter((_, i) => i !== idx))}
                    className="h-[38px] w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                    aria-label="Remove tender"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-1.5">
              {tenders.length < 4 && (
                <Button variant="secondary" size="sm" icon={Plus} onClick={addTender}>
                  Split payment
                </Button>
              )}
              {tenders.some((t) => t.method === 'CASH') && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => handleQuickCash('EXACT')}>
                    Exact
                  </Button>
                  {[100, 500, 1000, 5000].map((n) => (
                    <Button key={n} variant="secondary" size="sm" onClick={() => handleQuickCash(n)} className="tabular">
                      +{n.toLocaleString()}
                    </Button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[13px]" aria-live="polite">
            <div className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-slate-500">Paid now</p>
              <p className="text-lg font-semibold tabular text-slate-900">{formatCurrency(Math.min(paidNow, cartTotal), currencySymbol)}</p>
            </div>
            <div className={`px-3 py-2.5 rounded-xl border ${change > 0 ? 'bg-brand-50 border-brand-100' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-slate-500">Change to return</p>
              <p className={`text-lg font-semibold tabular ${change > 0 ? 'text-brand-700' : 'text-slate-400'}`}>
                {formatCurrency(change, currencySymbol)}
              </p>
            </div>
          </div>

          {toKhata > 0 && !isWalkIn && (
            <div
              className={`p-4 rounded-xl border text-[13px] space-y-1 ${
                overLimit ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <p className="font-semibold">{formatCurrency(toKhata, currencySymbol)} added to {activeCustomer?.name}'s khata</p>
              <p className="tabular">
                Balance goes from {formatCurrency(currentBalance, currencySymbol)} to <strong>{formatCurrency(newBalance, currencySymbol)}</strong>
                {creditLimit > 0 && <> (limit {formatCurrency(creditLimit, currencySymbol)})</>}.
              </p>
              {overLimit && <p className="font-medium">Over the credit limit: a manager PIN will be asked.</p>}
            </div>
          )}

          {submitted && error && (
            <p role="alert" className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Deliver to shop #12" optional />
        </form>
      </Modal>

      <ManagerPinModal
        isOpen={Boolean(approval)}
        reason={approval?.reason}
        onClose={() => setApproval(null)}
        onApproved={(token) => {
          setApproval(null);
          submitSale(token);
        }}
      />
    </>
  );
}
