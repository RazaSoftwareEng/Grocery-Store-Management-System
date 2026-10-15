import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

const StoreContext = createContext(null);

const CACHE_KEYS = {
  PRODUCTS: 'gsms_cached_products',
  CATEGORIES: 'gsms_cached_categories',
  CUSTOMERS: 'gsms_cached_customers',
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
};

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

export function StoreProvider({ children }) {
  const { showToast } = useToast();
  const { currentUser } = useAuth();

  // Initialize immediately from local cache for 0ms instant render
  const [products, setProducts] = useState(() => getCached(CACHE_KEYS.PRODUCTS, []));
  const [categories, setCategories] = useState(() => getCached(CACHE_KEYS.CATEGORIES, []));
  const [customers, setCustomers] = useState(() => getCached(CACHE_KEYS.CUSTOMERS, []));
  const [settings, setSettings] = useState(() => getCached(CACHE_KEYS.SETTINGS, DEFAULT_SETTINGS));
  const [users, setUsers] = useState(() => getCached(CACHE_KEYS.USERS, []));
  const [dashboardStats, setDashboardStats] = useState(() => getCached(CACHE_KEYS.STATS, null));

  // If cache is empty, show loading. If cache has items, don't block the screen!
  const [isLoading, setIsLoading] = useState(() => {
    const cachedProds = getCached(CACHE_KEYS.PRODUCTS, null);
    return cachedProds === null;
  });
  const [isLiveBackend, setIsLiveBackend] = useState(api.isLive());

  // POS State
  const [cart, setCart] = useState([]);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [activeCustomer, setActiveCustomer] = useState({
    customerId: 'WALK-IN',
    name: 'Walk-in Customer',
    phone: '',
    outstandingBalance: 0,
  });
  const [cashier, setCashier] = useState({
    id: 'CASHIER-1',
    name: 'Cashier (Counter 1)',
  });

  // Consolidated Fast Background Sync (Single Roundtrip)
  const refreshAllData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && products.length === 0) setIsLoading(true);

      const res = await api.getInitialStoreData();
      if (res?.success && res.data) {
        const {
          products: prods = [],
          categories: cats = [],
          customers: custs = [],
          settings: sets = {},
          users: usrs = [],
          dashboardStats: stats = null,
        } = res.data;

        setProducts(prods);
        setCategories(cats);
        setCustomers(custs);
        setSettings((prev) => ({ ...prev, ...sets }));
        setUsers(usrs);
        if (stats) setDashboardStats(stats);

        // Update persistent cache
        setCached(CACHE_KEYS.PRODUCTS, prods);
        setCached(CACHE_KEYS.CATEGORIES, cats);
        setCached(CACHE_KEYS.CUSTOMERS, custs);
        setCached(CACHE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...sets });
        setCached(CACHE_KEYS.USERS, usrs);
        if (stats) setCached(CACHE_KEYS.STATS, stats);
      }
      setIsLiveBackend(api.isLive());
    } catch (err) {
      console.warn('Background sync error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [products.length]);

  // Initial load, and reload after login/logout (database rows are only visible to signed-in staff)
  useEffect(() => {
    refreshAllData(true);
  }, [refreshAllData, currentUser?.userId]);

  // Record sales under the signed-in staff member
  useEffect(() => {
    if (currentUser) {
      setCashier({ id: currentUser.userId, name: currentUser.fullName || currentUser.username });
    }
  }, [currentUser]);

  // OPTIMISTIC UPDATES: Product Add / Edit (0ms instant UI reaction)
  const saveProductOptimistic = useCallback(async (productData) => {
    const isNew = !productData.productId;
    const tempId = productData.productId || `PROD-TEMP-${Date.now()}`;
    const categoryName = categories.find((c) => c.categoryId === productData.categoryId)?.name || 'General';

    const optimisticProd = {
      ...productData,
      productId: tempId,
      categoryName,
      costPrice: Number(productData.costPrice) || 0,
      sellingPrice: Number(productData.sellingPrice) || 0,
      currentStock: Number(productData.currentStock) || 0,
      minimumStock: Number(productData.minimumStock) || 5,
      status: productData.status || 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    // 1. Instant state update (0ms)
    setProducts((prev) => {
      const exists = prev.some((p) => p.productId === tempId);
      const updated = exists
        ? prev.map((p) => (p.productId === tempId ? optimisticProd : p))
        : [optimisticProd, ...prev];
      setCached(CACHE_KEYS.PRODUCTS, updated);
      return updated;
    });

    // 2. Background Google Sheets sync
    try {
      const res = await api.saveProduct(productData);
      if (res.success && res.data) {
        // If Google Sheet generated a permanent ID, update it
        if (isNew && res.data.productId) {
          setProducts((prev) => {
            const finalProds = prev.map((p) =>
              p.productId === tempId ? { ...res.data, categoryName } : p
            );
            setCached(CACHE_KEYS.PRODUCTS, finalProds);
            return finalProds;
          });
        }
      }
      return res;
    } catch (err) {
      console.error('Failed to sync product to Google Sheets:', err);
      showToast('Could not sync the product. It will retry on the next sync.', 'error');
      return { success: false, error: err.message };
    }
  }, [categories, showToast]);

  // OPTIMISTIC UPDATES: Product Delete (0ms instant UI reaction)
  const deleteProductOptimistic = useCallback(async (productId, permanent = false) => {
    // 1. Instant state removal (0ms)
    setProducts((prev) => {
      const updated = prev.filter((p) => p.productId !== productId);
      setCached(CACHE_KEYS.PRODUCTS, updated);
      return updated;
    });

    // 2. Background Google Sheets sync
    try {
      return await api.deleteProduct(productId, permanent);
    } catch (err) {
      console.error('Failed to delete from Google Sheets:', err);
      showToast('Could not delete. Check your connection and try again.', 'error');
      refreshAllData(true);
      return { success: false, error: err.message };
    }
  }, [refreshAllData, showToast]);

  // OPTIMISTIC UPDATES: Quick Stock Stepper (+ / -) in 1 Click!
  const quickAdjustStock = useCallback(async (productId, delta) => {
    const qtyChange = Number(delta);
    if (!qtyChange) return;

    let targetProd = null;

    // 1. Instant state update (0ms)
    setProducts((prev) => {
      const updated = prev.map((p) => {
        if (p.productId === productId) {
          const newStock = Math.max(0, (Number(p.currentStock) || 0) + qtyChange);
          targetProd = { ...p, currentStock: newStock };
          return targetProd;
        }
        return p;
      });
      setCached(CACHE_KEYS.PRODUCTS, updated);
      return updated;
    });

    showToast(
      qtyChange > 0
        ? `Added +${qtyChange} stock (New stock: ${targetProd?.currentStock || 0})`
        : `Deducted ${Math.abs(qtyChange)} stock (New stock: ${targetProd?.currentStock || 0})`,
      'info'
    );

    // 2. Background Google Sheets sync
    try {
      await api.adjustStock({
        productId,
        adjustmentType: qtyChange > 0 ? 'ADD' : 'SUBTRACT',
        quantity: Math.abs(qtyChange),
        reason: 'Quick stock adjustment from table',
      });
    } catch (err) {
      console.error('Background stock adjustment failed:', err);
    }
  }, [showToast]);

  // Cart operations
  const addToCart = useCallback((product, qty = 1) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.productId);
      const currentStock = Number(product.currentStock) || 0;
      const allowNegative = settings.allowNegativeStock === 'true' || settings.allowNegativeStock === true;
      const requestedQty = existing ? existing.quantity + qty : qty;

      if (!allowNegative && requestedQty > currentStock) {
        showToast(`Cannot add more than available stock (${currentStock}) for ${product.name}`, 'warning');
        return prevCart;
      }

      if (existing) {
        return prevCart.map((item) =>
          item.productId === product.productId
            ? { ...item, quantity: requestedQty }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product.productId,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            unit: product.unit || 'piece',
            sellingPrice: Number(product.sellingPrice) || 0,
            costPrice: Number(product.costPrice) || 0,
            currentStock: currentStock,
            quantity: qty,
            discount: 0,
          },
        ];
      }
    });
  }, [settings.allowNegativeStock, showToast]);

  const updateCartQty = useCallback((productId, newQty) => {
    const qty = Number(newQty);
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.productId === productId) {
          const allowNegative = settings.allowNegativeStock === 'true' || settings.allowNegativeStock === true;
          if (!allowNegative && qty > item.currentStock) {
            showToast(`Only ${item.currentStock} items in stock for ${item.name}`, 'warning');
            return item;
          }
          return { ...item, quantity: qty };
        }
        return item;
      });
    });
  }, [settings.allowNegativeStock, showToast]);

  const updateCartItemDiscount = useCallback((productId, discount) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId
          ? { ...item, discount: Math.max(0, Number(discount) || 0) }
          : item
      )
    );
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartDiscount(0);
    setActiveCustomer({
      customerId: 'WALK-IN',
      name: 'Walk-in Customer',
      phone: '',
      outstandingBalance: 0,
    });
  }, []);

  // Cart calculations
  const cartSubtotal = cart.reduce((sum, item) => {
    const itemTotal = item.sellingPrice * item.quantity - (item.discount || 0);
    return sum + Math.max(0, itemTotal);
  }, 0);

  const taxRate = Number(settings.taxRate) || 0;
  const cartTax = (cartSubtotal * taxRate) / 100;
  const cartTotal = Math.max(0, cartSubtotal + cartTax - cartDiscount);

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        customers,
        settings,
        users,
        dashboardStats,
        isLoading,
        isLiveBackend,
        setIsLiveBackend,
        cart,
        cartSubtotal,
        cartTax,
        cartDiscount,
        setCartDiscount,
        cartTotal,
        activeCustomer,
        setActiveCustomer,
        cashier,
        setCashier,
        addToCart,
        updateCartQty,
        updateCartItemDiscount,
        removeFromCart,
        clearCart,
        refreshAllData,
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
