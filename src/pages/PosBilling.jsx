import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import { ProductCard } from '../components/pos/ProductCard';
import { CartItem } from '../components/pos/CartItem';
import { CustomerSelectModal } from '../components/pos/CustomerSelectModal';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { SearchInput } from '../components/common/SearchInput';
import { Button, Kbd } from '../components/common/Button';
import { EmptyState } from '../components/common/Table';
import { formatCurrency } from '../utils/formatters';
import { createBarcodeListener } from '../utils/barcode';
import { api } from '../services/api';
import {
  ShoppingCart,
  Trash2,
  User,
  CreditCard,
  Barcode,
  ArrowRight,
  Database,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function PosBilling() {
  const {
    products,
    categories,
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
    updateCartItemDiscount,
    removeFromCart,
    clearCart,
    currencySymbol,
    settings,
    isLiveBackend,
    refreshAllData,
  } = useStore();

  const { showToast } = useToast();
  const confirm = useConfirm();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Mobile View Toggle: 'catalog' | 'cart'
  const [mobileTab, setMobileTab] = useState('catalog');

  const searchInputRef = useRef(null);

  // Hardware Barcode Scanner Listener
  useEffect(() => {
    const cleanup = createBarcodeListener((scannedBarcode) => {
      const match = products.find(
        (p) =>
          p.status !== 'INACTIVE' &&
          (p.barcode === scannedBarcode || p.sku === scannedBarcode)
      );

      if (match) {
        addToCart(match, 1);
        setSearch('');
        showToast(`Scanned: ${match.name}`, 'success');
      } else {
        showToast(`Barcode not recognized: ${scannedBarcode}`, 'warning');
      }
    });

    return cleanup;
  }, [products, addToCart, showToast]);

  // Keyboard shortcuts (F2: search, F4: clear, F8: checkout)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length) clearCart();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length) setIsPaymentModalOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, clearCart]);

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    if (p.status === 'INACTIVE') return false;
    if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) return false;
    if (!search.trim()) return true;

    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    );
  });

  // Enter in the search box: add the exact barcode/SKU match, or the only matching product.
  // Handles scanners typing into the focused search box as well as manual entry.
  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const q = search.trim();
    if (!q) return;
    e.preventDefault();
    e.stopPropagation(); // the global scanner listener must not add it a second time

    const exact = products.find(
      (p) =>
        p.status !== 'INACTIVE' &&
        (p.barcode === q || String(p.sku || '').toLowerCase() === q.toLowerCase())
    );
    const match = exact || (filteredProducts.length === 1 ? filteredProducts[0] : null);

    if (match) {
      addToCart(match, 1);
      setSearch('');
      showToast(`Added: ${match.name}`, 'success');
    } else if (filteredProducts.length > 1) {
      showToast(`${filteredProducts.length} products match. Click the one you want.`, 'info');
    } else {
      showToast(`No product found for "${q}"`, 'warning');
    }
  };

  const handleReceiptClose = () => {
    setIsReceiptModalOpen(false);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleSaleSuccess = (saleRecord) => {
    setCompletedSale(saleRecord);
    setIsReceiptModalOpen(true);
  };

  const handleClearDummyData = async () => {
    if (
      !(await confirm({
        title: 'Remove all sample data?',
        message: 'Every demo product and sale is deleted so you can start with an empty catalog.',
        confirmText: 'Remove sample data',
        tone: 'danger',
      }))
    ) {
      return;
    }
    api.clearAllDummyData();
    clearCart();
    refreshAllData();
    showToast('All dummy products removed. Store is clean.', 'success');
  };

  const [isEditingBillDiscount, setIsEditingBillDiscount] = useState(false);
  const [billDiscountInput, setBillDiscountInput] = useState('');
  const billDiscountValue = parseFloat(billDiscountInput);
  const billDiscountError =
    billDiscountInput.trim() === ''
      ? ''
      : Number.isNaN(billDiscountValue)
      ? 'Numbers only'
      : billDiscountValue < 0
      ? "Can't be negative"
      : billDiscountValue > cartSubtotal
      ? `Max ${formatCurrency(cartSubtotal, currencySymbol)}`
      : '';

  const applyBillDiscount = () => {
    if (billDiscountError) return;
    setCartDiscount(billDiscountInput.trim() === '' ? 0 : billDiscountValue);
    setIsEditingBillDiscount(false);
  };

  const allowNegativeStock =
    settings.allowNegativeStock === 'true' || settings.allowNegativeStock === true;

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeCount = products.filter((p) => p.status !== 'INACTIVE').length;

  const chip = (isOn) =>
    `h-8 px-3 rounded-full text-[13px] font-medium border transition-colors whitespace-nowrap ${
      isOn
        ? 'bg-slate-900 border-slate-900 text-white'
        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
    }`;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden gap-2">
      {/* Local mode notice */}
      {!isLiveBackend && isAdmin && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[13px] text-amber-900 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <span className="font-semibold">Local mode.</span> No database is connected yet, so sales are saved in this browser only.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="xs" onClick={handleClearDummyData} className="text-amber-800 hover:bg-amber-100">
              Clear samples
            </Button>
            <Link
              to="/settings"
              className="h-7 px-2.5 inline-flex items-center rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
            >
              Connect database
            </Link>
          </div>
        </div>
      )}

      {/* Mobile tab switcher */}
      <div className="lg:hidden grid grid-cols-2 p-1 gap-1 bg-slate-100 border border-slate-200 rounded-xl shrink-0 text-[13px] font-medium" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'catalog'}
          onClick={() => setMobileTab('catalog')}
          className={`h-8 rounded-lg transition-all ${
            mobileTab === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Products <span className="text-slate-400 tabular">({filteredProducts.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'cart'}
          onClick={() => setMobileTab('cart')}
          className={`h-8 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'cart' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Bill <span className="tabular">({totalCartCount})</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-2 overflow-hidden min-h-0">
        {/* Catalog */}
        <section
          aria-label="Products"
          className={`flex-1 min-w-0 flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${
            mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="p-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
            <SearchInput
              inputRef={searchInputRef}
              value={search}
              onChange={setSearch}
              onKeyDown={handleSearchKeyDown}
              placeholder="Scan a barcode or type a name, then Enter"
              className="flex-1 w-full"
              shortcut="F2"
              autoFocus
            />
            <div className="hidden md:flex items-center gap-1.5 h-[38px] px-3 border border-slate-200 rounded-xl text-xs text-slate-500 shrink-0">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-brand-500 opacity-60 animate-ping" />
                <span className="relative w-2 h-2 rounded-full bg-brand-500" />
              </span>
              <Barcode className="w-4 h-4 text-slate-400" />
              Scanner ready
            </div>
          </div>

          <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button type="button" onClick={() => setSelectedCategory('ALL')} className={chip(selectedCategory === 'ALL')}>
              All <span className="opacity-60 tabular">{activeCount}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.categoryId}
                type="button"
                onClick={() => setSelectedCategory(c.categoryId)}
                className={chip(selectedCategory === c.categoryId)}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex-1 p-3 overflow-y-auto bg-slate-50/60">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2.5">
                {filteredProducts.map((p) => (
                  <ProductCard
                    key={p.productId}
                    product={p}
                    onAdd={addToCart}
                    currencySymbol={currencySymbol}
                    allowNegativeStock={allowNegativeStock}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={search ? Barcode : ShoppingCart}
                title={search ? `Nothing matches "${search}"` : 'No products yet'}
                description={
                  search
                    ? 'Check the spelling or scan the barcode again.'
                    : 'Add products to your catalog to start billing.'
                }
                action={
                  isAdmin && !search ? (
                    <Link to="/products">
                      <Button variant="primary" size="sm">
                        Add products
                      </Button>
                    </Link>
                  ) : null
                }
                className="h-full"
              />
            )}
          </div>
        </section>

        {/* Bill */}
        <aside
          aria-label="Current bill"
          className={`w-full lg:w-[340px] xl:w-[380px] flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden shrink-0 ${
            mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
            <h2 className="text-[15px] font-semibold text-slate-900">
              Current bill <span className="text-slate-400 font-normal tabular">· {totalCartCount} items</span>
            </h2>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                icon={Trash2}
                onClick={clearCart}
                className="text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                title="Clear bill (F4)"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-900 truncate">{activeCustomer?.name || 'Walk-in customer'}</p>
              {Number(activeCustomer?.outstandingBalance) > 0 ? (
                <p className="text-xs text-amber-700 tabular truncate">
                  Khata {formatCurrency(activeCustomer.outstandingBalance, currencySymbol)}
                </p>
              ) : (
                <p className="text-xs text-slate-500 truncate">Add a customer for khata sales</p>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsCustomerModalOpen(true)}>
              Change
            </Button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
            {cart.length > 0 ? (
              cart.map((item) => (
                <CartItem
                  key={item.productId}
                  item={item}
                  onUpdateQty={updateCartQty}
                  onRemove={removeFromCart}
                  onUpdateDiscount={updateCartItemDiscount}
                  currencySymbol={currencySymbol}
                />
              ))
            ) : (
              <EmptyState
                icon={ShoppingCart}
                title="The bill is empty"
                description="Tap a product or scan a barcode to add it."
                className="h-full"
              />
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-1.5 shrink-0 text-[13px]">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="text-slate-900 tabular">{formatCurrency(cartSubtotal, currencySymbol)}</span>
            </div>

            <div className="flex justify-between items-center text-slate-600 min-h-7">
              {isEditingBillDiscount ? (
                <div className="flex items-start gap-1.5 w-full animate-in fade-in">
                  <div className="flex-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={billDiscountInput}
                      onChange={(e) => setBillDiscountInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyBillDiscount();
                        } else if (e.key === 'Escape') {
                          setIsEditingBillDiscount(false);
                        }
                      }}
                      autoFocus
                      placeholder="Bill discount"
                      aria-label="Bill discount"
                      aria-invalid={billDiscountError ? 'true' : undefined}
                      className={`w-full h-7 px-2 text-xs tabular rounded-lg border bg-white focus:outline-none focus:ring-[3px] ${
                        billDiscountError
                          ? 'border-rose-500 focus:ring-rose-600/15'
                          : 'border-slate-300 focus:border-brand-600 focus:ring-brand-600/20'
                      }`}
                    />
                    {billDiscountError && <p className="text-xs text-rose-600 mt-1">{billDiscountError}</p>}
                  </div>
                  <Button size="xs" onClick={applyBillDiscount} disabled={Boolean(billDiscountError)}>
                    Apply
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setIsEditingBillDiscount(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBillDiscountInput(cartDiscount ? String(cartDiscount) : '');
                      setIsEditingBillDiscount(true);
                    }}
                    className="inline-flex items-center gap-1 hover:text-slate-900 underline decoration-slate-300 underline-offset-2"
                  >
                    Discount
                  </button>
                  <span className={`tabular ${cartDiscount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    −{formatCurrency(cartDiscount, currencySymbol)}
                  </span>
                </>
              )}
            </div>

            {cartTax > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax ({settings.taxRate}%)</span>
                <span className="text-slate-900 tabular">{formatCurrency(cartTax, currencySymbol)}</span>
              </div>
            )}

            <div className="pt-2 mt-1 border-t border-dashed border-slate-300 flex items-baseline justify-between">
              <span className="text-sm font-medium text-slate-700">Total</span>
              <span key={cartTotal} className="text-2xl font-semibold text-slate-900 tabular tracking-tight animate-bump inline-block">
                {formatCurrency(cartTotal, currencySymbol)}
              </span>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => setIsPaymentModalOpen(true)}
              icon={CreditCard}
              className="w-full mt-2"
            >
              Charge {formatCurrency(cartTotal, currencySymbol)}
              <Kbd onDark className="ml-auto">F8</Kbd>
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile: floating bill button while browsing products */}
      {mobileTab === 'catalog' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-3 inset-x-3 z-30 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="w-full h-12 px-4 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-between text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-white/15 flex items-center justify-center text-xs tabular">
                {totalCartCount}
              </span>
              View bill
            </span>
            <span className="flex items-center gap-1.5 tabular">
              {formatCurrency(cartTotal, currencySymbol)}
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}

      {/* Modals */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelect={setActiveCustomer}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSaleComplete={handleSaleSuccess}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={handleReceiptClose}
        saleData={completedSale}
      />
    </div>
  );
}
