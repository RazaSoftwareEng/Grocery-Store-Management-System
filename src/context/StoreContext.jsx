import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { isWeightedUnit, round2 } from '../utils/formatters';
import { setStoreTimeZone } from '../utils/dates';

const StoreContext = createContext(null);

const CACHE_KEYS = {
  PRODUCTS: 'gsms_cached_products',
  CATEGORIES: 'gsms_cached_categories',
  SETTINGS: 'gsms_cached_settings',
  USERS: 'gsms_cached_users',
  STATS: 'gsms_cached_stats',
};

const DEFAULT_SETTINGS = {
  storeName: 'Bismillah Grocery & Supermarket',
  tagline: 'Fresh Groceries & Everyday Essentials',
  phone: '+92 300 1234567',
  address: 'Shop # 12, Commercial Market, Main Boulevard, Lahore',
  currency: 'PKR',
  currencySymbol: 'Rs.',
  taxRate: '0',
  receiptFooter: 'Thank you for shopping with us! Please come again.',
  receiptType: 'thermal80',
  allowNegativeStock: 'false',
  lowStockDefaultThreshold: '5',
  timezone: 'Asia/Karachi',
  cashierMaxDiscountPercent: '10',
  expiryAlertDays: '30',
  autoLockMinutes: '15',
  ntn: '',
  strn: '',
};

const WALK_IN = { customerId: 'WALK-IN', name: 'Walk-in Customer', phone: '', outstandingBalance: 0, creditLimit: 0 };

function getCached(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setCached(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

function clearCache() {
  Object.values(CACHE_KEYS).forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  });
}

/** Cart math, same order as create_sale(): lines -> bill discount -> tax -> total */
export function computeCartTotals(cart, billDiscount, taxRate) {
  const gross = cart.reduce((sum, item) => sum + round2(item.sellingPrice * item.quantity), 0);
  const subtotal = round2(cart.reduce((sum, item) => sum + round2(item.sellingPrice * item.quantity) - (item.discount || 0), 0));
  const discount = Math.min(round2(billDiscount), subtotal);
  const tax = round2(((subtotal - discount) * (Number(taxRate) || 0)) / 100);
  const lineDiscounts = round2(cart.reduce((sum, item) => sum + (item.discount || 0), 0));
  return {
    gross: round2(gross),
    subtotal,
    discount,
    tax,
    total: round2(subtotal - discount + tax),
    discountPercent: gross > 0 ? ((lineDiscounts + discount) / gross) * 100 : 0,
  };
}

export function StoreProvider({ children }) {
  const { showToast } = useToast();
  const { currentUser, isAdmin } = useAuth();

  // Initialize from local cache for an instant render
  const [products, setProducts] = useState(() => getCached(CACHE_KEYS.PRODUCTS, []));
  const [categories, setCategories] = useState(() => getCached(CACHE_KEYS.CATEGORIES, []));
  const [settings, setSettings] = useState(() => {
    const s = getCached(CACHE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    setStoreTimeZone(s.timezone);
    return s;
  });
  const [users, setUsers] = useState(() => getCached(CACHE_KEYS.USERS, []));
  const [dashboardStats, setDashboardStats] = useState(() => getCached(CACHE_KEYS.STATS, null));
  const [isLoading, setIsLoading] = useState(() => getCached(CACHE_KEYS.PRODUCTS, null) === null);

  // Cash drawer shift of the signed-in user (null = no open shift, undefined = not loaded)
  const [currentShift, setCurrentShift] = useState(undefined);

  // POS State
  const [cart, setCart] = useState([]);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [activeCustomer, setActiveCustomer] = useState(WALK_IN);

  const productsLenRef = useRef(products.length);
  productsLenRef.current = products.length;

  const refreshAllData = useCallback(async (isSilent = false) => {
    if (!currentUser) {
      // Signed out: only the store name and tagline are public
      const res = await api.getPublicStoreInfo();
      if (res.success) setSettings((prev) => ({ ...prev, ...res.data }));
      setIsLoading(false);
      return;
    }
    try {
      if (!isSilent && productsLenRef.current === 0) setIsLoading(true);
      const res = await api.getInitialStoreData({ isAdmin });
      if (res?.success && res.data) {
        const { products: prods = [], categories: cats = [], settings: sets = {}, users: usrs = [], dashboardStats: stats = null } = res.data;
        setProducts(prods);
        setCategories(cats);
        setSettings({ ...DEFAULT_SETTINGS, ...sets });
        setUsers(usrs);
        if (stats) setDashboardStats(stats);
        setCached(CACHE_KEYS.PRODUCTS, prods);
        setCached(CACHE_KEYS.CATEGORIES, cats);
        setCached(CACHE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...sets });
        setCached(CACHE_KEYS.USERS, usrs);
        if (stats) setCached(CACHE_KEYS.STATS, stats);
      }
    } catch (err) {
      console.warn('Background sync error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isAdmin]);

  // Cheap refresh after a sale: only the product list
  const refreshProducts = useCallback(async () => {
    const res = await api.getProducts();
    if (res.success) {
      setProducts(res.data);
      setCached(CACHE_KEYS.PRODUCTS, res.data);
    }
  }, []);

  const refreshShift = useCallback(async () => {
    if (!currentUser) {
      setCurrentShift(undefined);
      return null;
    }
    const res = await api.getCurrentShift();
    if (res.success) setCurrentShift(res.data || null);
    return res.success ? res.data : null;
  }, [currentUser]);

  // Initial load, and reload after login/logout
  useEffect(() => {
    if (!currentUser) {
      clearCache();
      setProducts([]);
      setCategories([]);
      setUsers([]);
      setDashboardStats(null);
      setCart([]);
    }
    refreshAllData(true);
    refreshShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.userId]);

  // Live stock across counters
  useEffect(() => {
    if (!currentUser) return undefined;
    const unsubscribe = api.subscribeProducts(({ type, product, oldId }) => {
      setProducts((prev) => {
        let next;
        if (type === 'DELETE') next = prev.filter((p) => p.productId !== oldId);
        else if (!product) return prev;
        else if (prev.some((p) => p.productId === product.productId)) {
          next = prev.map((p) => (p.productId === product.productId ? { ...p, ...product } : p));
        } else next = [...prev, product].sort((a, b) => a.name.localeCompare(b.name));
        setCached(CACHE_KEYS.PRODUCTS, next);
        return next;
      });
      if (product) {
        setCart((prev) => prev.map((i) => (i.productId === product.productId
          ? { ...i, currentStock: Number(product.currentStock) || 0, sellingPrice: Number(product.sellingPrice) || 0 }
          : i)));
      }
    });
    return unsubscribe;
  }, [currentUser]);

  // Product add / edit with an instant UI update
  const saveProductOptimistic = useCallback(async (productData) => {
    const isNew = !productData.productId;
    const tempId = productData.productId || `PROD-TEMP-${Date.now()}`;
    const optimisticProd = {
      ...productData,
      productId: tempId,
      costPrice: Number(productData.costPrice) || 0,
      sellingPrice: Number(productData.sellingPrice) || 0,
      currentStock: Number(productData.currentStock) || 0,
      minimumStock: Number(productData.minimumStock) || 5,
      status: productData.status || 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };
    setProducts((prev) => (prev.some((p) => p.productId === tempId)
      ? prev.map((p) => (p.productId === tempId ? { ...p, ...optimisticProd } : p))
      : [optimisticProd, ...prev]));

    const res = await api.saveProduct(productData);
    setProducts((prev) => {
      const next = res.success && res.data
        ? prev.map((p) => (p.productId === tempId ? res.data : p))
        : isNew ? prev.filter((p) => p.productId !== tempId) : prev;
      setCached(CACHE_KEYS.PRODUCTS, next);
      return next;
    });
    if (!res.success && !isNew) refreshProducts();
    return res;
  }, [refreshProducts]);

  const deleteProductOptimistic = useCallback(async (productId, permanent = false) => {
    const res = await api.deleteProduct(productId, permanent);
    if (res.success) {
      setProducts((prev) => {
        const updated = permanent
          ? prev.filter((p) => p.productId !== productId)
          : prev.map((p) => (p.productId === productId ? { ...p, status: 'INACTIVE' } : p));
        setCached(CACHE_KEYS.PRODUCTS, updated);
        return updated;
      });
    }
    return res;
  }, []);

  const quickAdjustStock = useCallback(async (productId, delta) => {
    const qtyChange = Number(delta);
    if (!qtyChange) return;
    const res = await api.adjustStock({
      productId,
      adjustmentType: qtyChange > 0 ? 'ADD' : 'SUBTRACT',
      quantity: Math.abs(qtyChange),
      reason: 'Quick stock adjustment from table',
    });
    if (res.success) {
      setProducts((prev) => prev.map((p) => (p.productId === productId ? { ...p, currentStock: res.currentStock } : p)));
      showToast(`${qtyChange > 0 ? 'Added' : 'Deducted'} ${Math.abs(qtyChange)} (new stock: ${res.currentStock})`, 'info');
    } else {
      showToast(res.error || 'Stock adjustment failed', 'error');
    }
  }, [showToast]);

  const allowNegative = settings.allowNegativeStock === 'true' || settings.allowNegativeStock === true;

  // Cart operations
  const addToCart = useCallback((product, qty = 1) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.productId);
      const currentStock = Number(product.currentStock) || 0;
      const requestedQty = round2((existing ? existing.quantity : 0) + qty);

      if (!allowNegative && requestedQty > currentStock) {
        showToast(`Cannot add more than available stock (${currentStock}) for ${product.name}`, 'warning');
        return prevCart;
      }
      if (existing) {
        return prevCart.map((item) => (item.productId === product.productId ? { ...item, quantity: requestedQty } : item));
      }
      return [
        ...prevCart,
        {
          productId: product.productId,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unit: product.unit || 'piece',
          sellingPrice: Number(product.sellingPrice) || 0,
          currentStock,
          quantity: qty,
          discount: 0,
        },
      ];
    });
  }, [allowNegative, showToast]);

  const removeFromCart = useCallback((productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const updateCartQty = useCallback((productId, newQty) => {
    setCart((prevCart) => {
      const item = prevCart.find((i) => i.productId === productId);
      if (!item) return prevCart;
      let qty = Number(newQty) || 0;
      qty = isWeightedUnit(item.unit) ? Math.round(qty * 1000) / 1000 : Math.round(qty);
      if (qty <= 0) return prevCart.filter((i) => i.productId !== productId);
      if (!allowNegative && qty > item.currentStock) {
        showToast(`Only ${item.currentStock} ${item.unit} in stock for ${item.name}`, 'warning');
        return prevCart;
      }
      const gross = round2(item.sellingPrice * qty);
      return prevCart.map((i) => (i.productId === productId ? { ...i, quantity: qty, discount: Math.min(i.discount || 0, gross) } : i));
    });
  }, [allowNegative, showToast]);

  const updateCartItemDiscount = useCallback((productId, discount) => {
    setCart((prevCart) =>
      prevCart.map((item) => (item.productId === productId ? { ...item, discount: Math.max(0, round2(discount)) } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartDiscount(0);
    setActiveCustomer(WALK_IN);
  }, []);

  // Resume a held bill (prices and stock refreshed from the current catalog)
  const loadCart = useCallback((items, billDiscount = 0, customer = null) => {
    const byId = Object.fromEntries(products.map((p) => [p.productId, p]));
    setCart(
      (items || [])
        .filter((i) => byId[i.productId])
        .map((i) => ({
          ...i,
          sellingPrice: Number(byId[i.productId].sellingPrice) || 0,
          currentStock: Number(byId[i.productId].currentStock) || 0,
          unit: byId[i.productId].unit || i.unit,
        }))
    );
    setCartDiscount(Number(billDiscount) || 0);
    setActiveCustomer(customer && customer.customerId ? customer : WALK_IN);
  }, [products]);

  const totals = computeCartTotals(cart, cartDiscount, settings.taxRate);

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        settings,
        users,
        dashboardStats,
        isLoading,
        cart,
        cartGross: totals.gross,
        cartSubtotal: totals.subtotal,
        cartTax: totals.tax,
        cartDiscount,
        setCartDiscount,
        cartTotal: totals.total,
        cartDiscountPercent: totals.discountPercent,
        activeCustomer,
        setActiveCustomer,
        walkInCustomer: WALK_IN,
        addToCart,
        updateCartQty,
        updateCartItemDiscount,
        removeFromCart,
        clearCart,
        loadCart,
        currentShift,
        refreshShift,
        refreshAllData,
        refreshProducts,
        saveProductOptimistic,
        deleteProductOptimistic,
        quickAdjustStock,
        currencySymbol: settings.currencySymbol || 'Rs.',
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
