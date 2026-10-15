import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { ProductCard } from '../components/pos/ProductCard';
import { CartItem } from '../components/pos/CartItem';
import { CustomerSelectModal } from '../components/pos/CustomerSelectModal';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { SearchInput } from '../components/common/SearchInput';
import { Button } from '../components/common/Button';
import { formatCurrency } from '../utils/formatters';
import { createBarcodeListener } from '../utils/barcode';
import { api } from '../services/api';
import {
  ShoppingCart,
  Trash2,
  User,
  CreditCard,
  Barcode,
  Layers,
  ArrowRight,
  Database,
  CloudAlert,
  Sparkles,
  ExternalLink
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

  const handleSaleSuccess = (saleRecord) => {
    setCompletedSale(saleRecord);
    setIsReceiptModalOpen(true);
  };

  const handleClearDummyData = () => {
    if (
      !window.confirm(
        'Are you sure you want to remove all dummy products and demo data? Your database will be completely clean and empty, ready for your real Google Sheet items.'
      )
    ) {
      return;
    }
    api.clearAllDummyData();
    clearCart();
    refreshAllData();
    showToast('All dummy products removed. Store is clean.', 'success');
  };

  const allowNegativeStock =
    settings.allowNegativeStock === 'true' || settings.allowNegativeStock === true;

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none gap-2">
      {/* Top Notice when in Local Mode */}
      {!isLiveBackend && (
        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>Local Mode:</strong> Google Sheet abhi connect nahi hai. Data browser me save ho raha hai.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearDummyData}
              className="text-rose-700 hover:text-rose-900 font-bold underline"
              title="Remove sample items and start with 0 products"
            >
              Clear Dummy Data
            </button>
            <Link
              to="/settings"
              className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors"
            >
              Connect Google Sheet
            </Link>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher (< 1024px) */}
      <div className="lg:hidden flex items-center bg-slate-200/80 p-1 rounded-xl shrink-0 text-xs font-bold">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            mobileTab === 'catalog'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Product Catalog ({filteredProducts.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'cart'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Cart ({totalCartCount}) • {formatCurrency(cartTotal, currencySymbol)}
        </button>
      </div>

      {/* Main Dual Pane Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2.5 overflow-hidden">
        {/* LEFT SECTION: Catalog & Search */}
        <div
          className={`flex-1 flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden ${
            mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Search & Barcode helper bar */}
          <div className="p-2 sm:p-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50 shrink-0">
            <SearchInput
              inputRef={searchInputRef}
              value={search}
              onChange={setSearch}
              placeholder="Search products by name, SKU or barcode (F2)..."
              className="flex-1 w-full"
              autoFocus
            />
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 font-mono shrink-0">
              <Barcode className="w-4 h-4 text-emerald-600" />
              <span>Scanner Ready</span>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              All Items ({products.filter((p) => p.status !== 'INACTIVE').length})
            </button>
            {categories.map((c) => (
              <button
                key={c.categoryId}
                type="button"
                onClick={() => setSelectedCategory(c.categoryId)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === c.categoryId
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Products Grid (Fluid auto-fill minmax grid to prevent squishing) */}
          <div className="flex-1 p-2 sm:p-2.5 overflow-y-auto">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2 sm:gap-2.5">
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
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <ShoppingCart className="w-10 h-10 text-slate-300 stroke-1 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No products available</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                  {search
                    ? 'No products match your search query.'
                    : 'Your catalog is clean and empty. Add new products or connect your Google Sheet!'}
                </p>
                <Link to="/products" className="mt-3">
                  <Button variant="primary" size="sm">
                    + Add New Product
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION: Cart Panel & Checkout */}
        <div
          className={`w-full lg:w-72 xl:w-80 2xl:w-96 flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden shrink-0 ${
            mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Customer Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/75 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {activeCustomer?.name || 'Walk-in Customer'}
                </p>
                {Number(activeCustomer?.outstandingBalance) > 0 && (
                  <p className="text-[10px] text-amber-700 font-semibold truncate">
                    Bal: {formatCurrency(activeCustomer.outstandingBalance, currencySymbol)}
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCustomerModalOpen(true)}
              className="text-xs py-1 px-2 bg-white"
            >
              Change
            </Button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-2 sm:p-2.5 overflow-y-auto space-y-2">
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
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 text-center">
                <ShoppingCart className="w-10 h-10 text-slate-200 stroke-1 mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cart is empty
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[180px]">
                  Click items from catalog or scan product barcode
                </p>
              </div>
            )}
          </div>

          {/* Financial Summary & Checkout Footer */}
          <div className="p-2.5 sm:p-3 border-t border-slate-200 bg-slate-50/70 space-y-2 shrink-0">
            {/* Subtotal, Discount, Tax */}
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(cartSubtotal, currencySymbol)}
                </span>
              </div>

              <div className="flex justify-between items-center text-rose-600">
                <div className="flex items-center gap-1">
                  <span>Discount:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = prompt('Enter bill discount amount (PKR):', cartDiscount);
                      if (val !== null) setCartDiscount(Math.max(0, parseFloat(val) || 0));
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                  >
                    (edit)
                  </button>
                </div>
                <span className="font-semibold">
                  -{formatCurrency(cartDiscount, currencySymbol)}
                </span>
              </div>

              {cartTax > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({settings.taxRate}%):</span>
                  <span className="font-semibold text-slate-800">
                    +{formatCurrency(cartTax, currencySymbol)}
                  </span>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Total Payable
                </span>
                <span className="text-lg font-black text-slate-950 font-mono">
                  {formatCurrency(cartTotal, currencySymbol)}
                </span>
              </div>

              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={clearCart}
                  className="text-slate-400 hover:text-rose-600 text-xs px-2 py-1"
                  title="Clear Cart (F4)"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Checkout Button */}
            <Button
              variant="primary"
              size="md"
              disabled={cart.length === 0}
              onClick={() => setIsPaymentModalOpen(true)}
              icon={CreditCard}
              className="w-full py-2.5 text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20"
            >
              Pay & Checkout (F8)
            </Button>
          </div>
        </div>
      </div>

      {/* Floating Checkout Button for Mobile (< 1024px) when viewing Catalog */}
      {mobileTab === 'catalog' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-3 inset-x-3 z-30 animate-in slide-in-from-bottom-3 duration-150">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="w-full p-3 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs">
                {totalCartCount}
              </span>
              <span>View Cart</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <span>{formatCurrency(cartTotal, currencySymbol)}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
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
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={completedSale}
      />
    </div>
  );
}
