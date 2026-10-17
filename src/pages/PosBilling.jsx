import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CustomerSelectModal } from '../components/pos/CustomerSelectModal';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { HeldBillsModal } from '../components/pos/HeldBillsModal';
import { OpenShiftPanel } from '../components/pos/OpenShiftPanel';
import { ManagerPinModal } from '../components/common/ManagerPinModal';
import { Button } from '../components/common/Button';
import { formatCurrency, formatNumber, isWeightedUnit, round2 } from '../utils/formatters';
import { createBarcodeListener } from '../utils/barcode';
import { api } from '../services/api';
import { Search, Trash2, PauseCircle, ListRestart, CheckCircle2, Minus, Plus, X, User } from 'lucide-react';

/**
 * Simple counter billing: search -> bill table -> total, received, change -> complete & print.
 * Card / khata / split payments open the full payment dialog.
 */
export function PosBilling() {
  const {
    products,
    cart,
    cartSubtotal,
    cartTax,
    cartDiscount,
    setCartDiscount,
    cartTotal,
    activeCustomer,
    setActiveCustomer,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    loadCart,
    currencySymbol,
    settings,
    currentShift,
    refreshProducts,
    refreshShift,
  } = useStore();
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const f = (n) => formatCurrency(n, currencySymbol);

  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [received, setReceived] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [approval, setApproval] = useState(null);
  const [lastAddedId, setLastAddedId] = useState(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isHeldOpen, setIsHeldOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');

  const searchRef = useRef(null);
  const receivedRef = useRef(null);

  const focusSearch = () => setTimeout(() => searchRef.current?.focus(), 0);

  // --- product search ---
  const q = search.trim().toLowerCase();
  const suggestions = q
    ? products
        .filter((p) => p.status !== 'INACTIVE')
        .filter((p) => p.barcode === search.trim() || String(p.sku || '').toLowerCase() === q || p.name?.toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q))
        .slice(0, 8)
    : [];

  const addProduct = (p) => {
    addToCart(p, 1);
    setLastAddedId(p.productId);
    setSearch('');
    setSel(0);
    focusSearch();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // the global scanner listener must not add it again
      const t = search.trim();
      if (!t) {
        if (cart.length) receivedRef.current?.focus();
        return;
      }
      const exact = products.find((p) => p.status !== 'INACTIVE' && (p.barcode === t || String(p.sku || '').toLowerCase() === t.toLowerCase()));
      const match = exact || suggestions[sel];
      if (match) addProduct(match);
      else showToast(`No product found for "${t}"`, 'warning');
    } else if (e.key === 'Escape') {
      setSearch('');
    }
  };

  // Hardware scanner while focus is elsewhere
  useEffect(() => {
    return createBarcodeListener((code) => {
      const match = products.find((p) => p.status !== 'INACTIVE' && (p.barcode === code || p.sku === code));
      if (match) addProduct(match);
      else showToast(`Barcode not recognized: ${code}`, 'warning');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, addToCart, showToast]);

  // --- held bills ---
  const refreshHeldCount = async () => {
    const res = await api.getHeldBills();
    if (res.success) setHeldCount(res.data.length);
  };

  useEffect(() => {
    refreshHeldCount();
  }, []);

  const handleHold = async () => {
    if (!cart.length) return;
    const note = window.prompt('Note for this held bill (optional), e.g. customer name', activeCustomer?.customerId !== 'WALK-IN' ? activeCustomer?.name : '');
    if (note === null) return;
    setIsHolding(true);
    const res = await api.holdBill({
      cart: cart.map(({ productId, name, sku, barcode, unit, quantity, discount }) => ({ productId, name, sku, barcode, unit, quantity, discount })),
      customer: activeCustomer,
      billDiscount: cartDiscount,
      note,
    });
    setIsHolding(false);
    if (res.success) {
      clearCart();
      setReceived('');
      showToast('Bill put on hold. Resume it from "Held".', 'success');
      refreshHeldCount();
      focusSearch();
    } else showToast(res.error || 'Could not hold the bill', 'error');
  };

  const handleResume = (bill) => {
    loadCart(bill.cart, bill.billDiscount, bill.customer);
    setIsHeldOpen(false);
    setReceived('');
    showToast('Held bill loaded. Prices refreshed from the current catalog.', 'info');
  };

  // --- payment ---
  const receivedNum = parseFloat(received);
  const hasReceived = received.trim() !== '' && !Number.isNaN(receivedNum);
  const change = hasReceived ? round2(receivedNum - cartTotal) : null;
  const canComplete = cart.length > 0 && hasReceived && receivedNum >= cartTotal && !isCompleting;

  const showReceipt = (data) => {
    setCompletedSale(data);
    setIsReceiptModalOpen(true);
  };

  const completeCash = async (approvalToken = null) => {
    if (!canComplete && !approvalToken) return;
    setIsCompleting(true);
    const res = await api.createSale({
      customerId: activeCustomer?.customerId || 'WALK-IN',
      items: cart,
      discount: cartDiscount,
      payments: [{ method: 'CASH', amount: receivedNum }],
      approvalToken,
    });
    setIsCompleting(false);
    if (res.success) {
      clearCart();
      setReceived('');
      showReceipt(res.data);
      refreshProducts();
      refreshShift();
    } else if (res.needsApproval) {
      setApproval({ reason: res.error });
    } else {
      showToast(res.error || 'Could not complete the sale', 'error');
    }
  };

  const applyDiscount = () => {
    const v = parseFloat(discountInput);
    if (discountInput.trim() !== '' && (Number.isNaN(v) || v < 0 || v > cartSubtotal)) {
      showToast(`Discount must be between 0 and ${f(cartSubtotal)}`, 'warning');
      return;
    }
    setCartDiscount(discountInput.trim() === '' ? 0 : v);
    setIsEditingDiscount(false);
  };

  if (currentShift === null && !isAdmin) {
    return <OpenShiftPanel />;
  }

  return (
    <div className="flex-1 flex flex-col lg:h-full min-h-0 lg:overflow-hidden gap-2 sm:gap-3 max-w-6xl w-full mx-auto">
      {/* 1. Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-slate-400 pointer-events-none" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSel(0);
            setShowSuggest(true);
          }}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          placeholder="Scan a barcode or type a product name, then Enter"
          aria-label="Search product"
          autoFocus
          autoComplete="off"
          className="w-full h-12 sm:h-14 pl-12 sm:pl-14 pr-4 text-base sm:text-lg bg-white border-2 border-brand-600 rounded-2xl outline-none focus:ring-4 focus:ring-brand-600/15"
        />
        {showSuggest && suggestions.length > 0 && (
          <div className="absolute z-20 top-full mt-1.5 inset-x-0 max-h-[50vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            {suggestions.map((p, i) => (
              <button
                key={p.productId}
                type="button"
                onMouseDown={() => addProduct(p)}
                className={`w-full flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-0.5 px-4 sm:px-5 py-2.5 text-left text-[15px] ${i === sel ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
              >
                <span className="font-medium text-slate-900 truncate">{p.name}</span>
                <span className="text-[13px] text-slate-500 tabular shrink-0">
                  {f(p.sellingPrice)} / {p.unit} · stock {formatNumber(p.currentStock)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Bill */}
      <section aria-label="Current bill" className="flex-1 min-h-[220px] lg:min-h-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <p className="text-[14px] text-slate-700">
            <span className="font-semibold text-slate-900">Bill</span> · {cart.length} items
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={ListRestart} onClick={() => setIsHeldOpen(true)}>
              <span className="hidden sm:inline">Held</span>{heldCount > 0 ? ` (${heldCount})` : ''}
            </Button>
            <Button variant="ghost" size="sm" icon={PauseCircle} onClick={handleHold} isLoading={isHolding} disabled={!cart.length}>
              <span className="hidden sm:inline">Hold</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => {
                clearCart();
                setReceived('');
                focusSearch();
              }}
              disabled={!cart.length}
              className="hover:text-rose-700 hover:bg-rose-50"
            >
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center p-10 text-center text-slate-500 text-[15px]">
              The bill is empty. Scan a barcode or type a product name above and press Enter.
            </div>
          ) : (
            <table className="w-full text-[14px] sm:text-[15px]">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="hidden sm:table-cell text-left font-medium px-4 py-2 w-10">#</th>
                  <th className="text-left font-medium px-3 sm:px-4 py-2">Item</th>
                  <th className="hidden md:table-cell text-right font-medium px-4 py-2">Price</th>
                  <th className="text-left font-medium px-2 sm:px-4 py-2">Qty</th>
                  <th className="text-right font-medium px-2 sm:px-4 py-2">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item, i) => (
                  <CartRow
                    key={item.productId}
                    index={i + 1}
                    item={item}
                    highlight={item.productId === lastAddedId}
                    onQty={updateCartQty}
                    onRemove={removeFromCart}
                    f={f}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 3. Pay */}
      <section aria-label="Payment" className="shrink-0 bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-4">
        <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-4 lg:gap-x-6 gap-y-2.5 items-end">
          <div className="order-last lg:order-none col-span-2 lg:col-span-1 text-[13px] text-slate-600 space-y-1.5">
            <p className="flex flex-wrap items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              Customer: <span className="font-semibold text-slate-900">{activeCustomer?.name || 'Walk-in'}</span>
              {Number(activeCustomer?.outstandingBalance) > 0 && (
                <span className="text-amber-700 tabular">(khata {f(activeCustomer.outstandingBalance)})</span>
              )}
              <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="text-brand-700 underline underline-offset-2 ml-1">
                Change
              </button>
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {isEditingDiscount ? (
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyDiscount();
                      if (e.key === 'Escape') setIsEditingDiscount(false);
                    }}
                    autoFocus
                    placeholder="Discount"
                    aria-label="Bill discount"
                    className="w-28 h-8 px-2 border border-slate-300 rounded-lg tabular"
                  />
                  <Button size="xs" onClick={applyDiscount}>Apply</Button>
                  <Button size="xs" variant="ghost" onClick={() => setIsEditingDiscount(false)}>Cancel</Button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDiscountInput(cartDiscount ? String(cartDiscount) : '');
                    setIsEditingDiscount(true);
                  }}
                  className="text-brand-700 underline underline-offset-2"
                >
                  {cartDiscount > 0 ? `Discount −${f(cartDiscount)}` : 'Add discount'}
                </button>
              )}
              <button type="button" onClick={() => setIsPaymentModalOpen(true)} disabled={!cart.length} className="text-brand-700 underline underline-offset-2 disabled:opacity-40">
                Card / Khata / Split
              </button>
              {cartTax > 0 && <span className="tabular">Tax ({settings.taxRate}%) {f(cartTax)}</span>}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p key={cartTotal} className="text-2xl sm:text-3xl font-bold text-slate-900 tabular tracking-tight animate-bump whitespace-nowrap">{f(cartTotal)}</p>
          </div>

          <div>
            <label htmlFor="pos-received" className="text-xs text-slate-500">
              Received
            </label>
            <input
              id="pos-received"
              ref={receivedRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  completeCash();
                }
              }}
              placeholder="0"
              className="block w-full lg:w-44 h-11 px-3 text-xl font-bold text-right tabular border-2 border-slate-300 rounded-xl outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
            />
          </div>

          <div className="col-span-2 sm:col-span-1 lg:min-w-[140px]">
            <p className="text-xs text-slate-500">Change to return</p>
            {change === null || !cart.length ? (
              <p className="text-xl font-bold text-slate-300">—</p>
            ) : change < 0 ? (
              <p className="text-base font-semibold text-rose-600 tabular">Short by {f(-change)}</p>
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-brand-700 tabular whitespace-nowrap">{f(change)}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => completeCash()}
          disabled={!canComplete}
          className="mt-3 w-full h-12 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-base sm:text-lg font-bold flex items-center justify-center gap-2.5 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          <CheckCircle2 className="w-6 h-6" />
          {isCompleting ? 'Saving…' : 'Complete & Print Bill'}
        </button>
      </section>

      <CustomerSelectModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSelect={setActiveCustomer} />
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSaleComplete={(data) => {
          setReceived('');
          showReceipt(data);
        }}
      />
      <HeldBillsModal
        isOpen={isHeldOpen}
        onClose={() => setIsHeldOpen(false)}
        onResume={handleResume}
        hasCurrentCart={cart.length > 0}
        onChanged={refreshHeldCount}
      />
      <ManagerPinModal
        isOpen={Boolean(approval)}
        reason={approval?.reason}
        onClose={() => setApproval(null)}
        onApproved={(token) => {
          setApproval(null);
          completeCash(token);
        }}
      />
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          focusSearch();
        }}
        saleData={completedSale}
      />
    </div>
  );
}

function CartRow({ index, item, highlight, onQty, onRemove, f }) {
  const weighted = isWeightedUnit(item.unit);
  const [qty, setQty] = useState(String(item.quantity));
  const [prevQty, setPrevQty] = useState(item.quantity);
  if (prevQty !== item.quantity) {
    setPrevQty(item.quantity);
    setQty(String(item.quantity));
  }
  const commit = () => {
    const n = weighted ? parseFloat(qty) : parseInt(qty, 10);
    if (!Number.isFinite(n) || n <= 0) setQty(String(item.quantity));
    else if (n !== item.quantity) onQty(item.productId, n);
  };
  const amount = round2(item.sellingPrice * item.quantity - (item.discount || 0));

  return (
    <tr className={highlight ? 'animate-in fade-in bg-brand-50/40' : ''}>
      <td className="hidden sm:table-cell px-4 py-2 text-slate-400 tabular">{index}</td>
      <td className="px-3 sm:px-4 py-2">
        <p className="font-semibold text-slate-900 leading-snug">{item.name}</p>
        <p className="md:hidden text-xs text-slate-500 tabular">{f(item.sellingPrice)} /{item.unit}</p>
        {item.discount > 0 && <p className="text-xs text-rose-600 tabular">Discount −{f(item.discount)}</p>}
      </td>
      <td className="hidden md:table-cell px-4 py-2 text-right tabular text-slate-600 whitespace-nowrap">
        {f(item.sellingPrice)}
        <span className="text-xs text-slate-400"> /{item.unit}</span>
      </td>
      <td className="px-2 sm:px-4 py-2">
        <div className="inline-flex items-center h-9 rounded-xl border border-slate-300 overflow-hidden">
          <button
            type="button"
            onClick={() => (item.quantity <= 1 ? onRemove(item.productId) : onQty(item.productId, round2(item.quantity - 1)))}
            className="w-9 h-full flex items-center justify-center hover:bg-slate-100"
            aria-label={`Less ${item.name}`}
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            value={qty}
            inputMode={weighted ? 'decimal' : 'numeric'}
            onChange={(e) => setQty(e.target.value.replace(weighted ? /[^\d.]/g : /\D/g, ''))}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            aria-label={`Quantity of ${item.name}`}
            className="w-11 sm:w-14 h-full text-center font-semibold tabular border-x border-slate-200 outline-none focus:bg-brand-50"
          />
          <button
            type="button"
            onClick={() => onQty(item.productId, round2(item.quantity + 1))}
            className="w-9 h-full flex items-center justify-center hover:bg-slate-100"
            aria-label={`More ${item.name}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </td>
      <td className="px-2 sm:px-4 py-2 text-right font-bold text-slate-900 tabular whitespace-nowrap">{f(amount)}</td>
      <td className="pr-3">
        <button type="button" onClick={() => onRemove(item.productId)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Remove ${item.name}`}>
          <X className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
