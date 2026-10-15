/**
 * Supabase Backend Service
 * Same method names and { success, data, error } response shape as the
 * Google Apps Script / local demo services, so pages work unchanged.
 *
 * Database columns are snake_case; the app uses camelCase. Rows are
 * converted in both directions here. Multi-step writes (sales, cancellations,
 * stock, purchases, payments, users) run as Postgres functions defined in
 * supabase/schema.sql so they are atomic.
 */

import { supabase } from './supabaseClient';
import { mockDataService } from './mockDataService';
import { buildCashierSummary } from '../utils/cashierSummary';

// Staff usernames map to Supabase Auth emails (must match schema.sql)
const AUTH_EMAIL_DOMAIN = 'grocery.local';
const PAGE_SIZE = 1000;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';

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

// ---------- helpers ----------

const toCamelKey = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function toCamel(value) {
  if (Array.isArray(value)) return value.map(toCamel);
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[toCamelKey(k)] = toCamel(v);
    return out;
  }
  return value;
}

function num(val, fallback = 0) {
  if (val === '' || val === null || val === undefined) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

const textOr = (val, fallback = '') => (val === null || val === undefined ? fallback : String(val));

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const data = check(await buildQuery().range(from, from + PAGE_SIZE - 1));
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function rpc(fn, args) {
  return check(await supabase.rpc(fn, args));
}

// Run a handler and convert thrown errors into { success: false, error }
async function run(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('Supabase request failed:', err);
    return { success: false, error: err.message || 'Database request failed' };
  }
}

function localDateStr(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Start of a local calendar day ('YYYY-MM-DD') as an ISO timestamp
const localDayStartIso = (dateStr) => new Date(`${dateStr}T00:00:00`).toISOString();
function localNextDayStartIso(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function mapUser(profile) {
  return {
    userId: profile.id,
    username: profile.username,
    fullName: profile.full_name || profile.username,
    role: profile.role || 'CASHIER',
    email: profile.email || '',
    status: profile.status || 'ACTIVE',
    createdAt: profile.created_at,
  };
}

// ---------- service ----------

export const supabaseService = {
  backendName: 'Supabase',

  // Interface compatibility with the Apps Script service
  isLive: () => true,
  getEndpointUrl: () => import.meta.env.VITE_SUPABASE_URL || '',
  setEndpointUrl: () => {},
  setForceLocal: () => {},

  async testConnection() {
    return run(async () => {
      check(await supabase.from('settings').select('key').limit(1));
      return { success: true, message: 'Supabase database is connected and online' };
    });
  },

  // ----- auth -----

  async login(username, password) {
    return run(async () => {
      const uname = String(username || '').trim().toLowerCase();
      const email = uname.includes('@') ? uname : `${uname}@${AUTH_EMAIL_DOMAIN}`;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: String(password || '') });
      if (error) {
        const msg = /invalid login credentials/i.test(error.message) ? 'Invalid username or password' : error.message;
        return { success: false, error: msg };
      }

      const profile = check(await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle());
      if (!profile) {
        await supabase.auth.signOut();
        return { success: false, error: 'No staff profile found for this account. Ask the store manager.' };
      }
      if (profile.status !== 'ACTIVE') {
        await supabase.auth.signOut();
        return { success: false, error: 'This user account is inactive. Contact the store manager.' };
      }
      return { success: true, user: mapUser(profile) };
    });
  },

  async logout() {
    await supabase.auth.signOut();
  },

  // Returns the signed-in staff user, or null if there is no valid session
  async getCurrentUser() {
    const { data } = await supabase.auth.getSession();
    const authUser = data?.session?.user;
    if (!authUser) return null;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
    return profile && profile.status === 'ACTIVE' ? mapUser(profile) : null;
  },

  // ----- dashboard & initial load -----

  async getDashboardStats() {
    return run(async () => {
      const raw = await rpc('dashboard_stats', { p_tz: TIME_ZONE });
      const { dailySales = {}, recentSales = [], ...rest } = raw || {};

      const weeklySalesTrend = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = localDateStr(d);
        weeklySalesTrend.push({
          date,
          label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          sales: num(dailySales[date]),
        });
      }

      return { success: true, data: { ...rest, recentSales: toCamel(recentSales), weeklySalesTrend } };
    });
  },

  async getInitialStoreData() {
    return run(async () => {
      const [productsRes, categoriesRes, customersRes, settingsRes, usersRes, statsRes] = await Promise.all([
        this.getProducts(),
        this.getCategories(),
        this.getCustomers(),
        this.getSettings(),
        this.getUsers(),
        this.getDashboardStats(),
      ]);
      const failed = [productsRes, categoriesRes, customersRes, settingsRes].find((r) => !r.success);
      if (failed) return failed;

      return {
        success: true,
        data: {
          products: productsRes.data,
          categories: categoriesRes.data,
          customers: customersRes.data,
          settings: settingsRes.data,
          users: usersRes.success ? usersRes.data : [],
          dashboardStats: statsRes.success ? statsRes.data : null,
        },
      };
    });
  },

  // ----- products -----

  async getProducts() {
    return run(async () => {
      const [products, categories] = await Promise.all([
        fetchAll(() => supabase.from('products').select('*').order('name')),
        fetchAll(() => supabase.from('categories').select('category_id, name')),
      ]);
      const catMap = Object.fromEntries(categories.map((c) => [c.category_id, c.name]));
      const data = products.map((p) => ({ ...toCamel(p), categoryName: catMap[p.category_id] || 'General' }));
      return { success: true, data };
    });
  },

  async saveProduct(productData) {
    return run(async () => {
      const now = new Date().toISOString();
      const id = productData.productId && !String(productData.productId).startsWith('PROD-TEMP-')
        ? productData.productId
        : null;

      const fields = {
        name: productData.name,
        sku: productData.sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
        barcode: textOr(productData.barcode),
        category_id: productData.categoryId || null,
        unit: productData.unit || 'piece',
        cost_price: num(productData.costPrice),
        selling_price: num(productData.sellingPrice),
        minimum_stock: num(productData.minimumStock, 5),
        expiry_date: productData.expiryDate || null,
        status: productData.status || 'ACTIVE',
        updated_at: now,
      };

      if (id) {
        const row = check(await supabase.from('products').update(fields).eq('product_id', id).select().single());
        return { success: true, data: toCamel(row), message: 'Product updated successfully' };
      }

      const initialStock = num(productData.currentStock);
      const row = check(
        await supabase.from('products').insert({ ...fields, current_stock: initialStock, status: 'ACTIVE' }).select().single()
      );
      if (initialStock > 0) {
        check(await supabase.from('stock_movements').insert({
          product_id: row.product_id,
          movement_type: 'INITIAL_STOCK',
          quantity: initialStock,
          previous_stock: 0,
          new_stock: initialStock,
          reference_type: 'MANUAL',
          reference_id: row.product_id,
          reason: 'Initial inventory creation',
          created_by: 'Admin',
        }));
      }
      return { success: true, data: toCamel(row), message: 'Product created successfully' };
    });
  },

  async deleteProduct(productId, permanent = false) {
    return run(async () => {
      if (permanent) {
        check(await supabase.from('products').delete().eq('product_id', productId));
        return { success: true, message: 'Product permanently deleted' };
      }
      check(await supabase.from('products')
        .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
        .eq('product_id', productId));
      return { success: true, message: 'Product marked as inactive' };
    });
  },

  async adjustStock(data) {
    return run(async () => {
      const currentStock = await rpc('adjust_stock', {
        p_product_id: data.productId,
        p_adjustment_type: data.adjustmentType,
        p_quantity: num(data.quantity),
        p_reason: data.reason || '',
        p_created_by: data.createdBy || 'Manager',
      });
      return { success: true, message: 'Stock adjusted successfully', currentStock: num(currentStock) };
    });
  },

  // ----- categories -----

  async getCategories() {
    return run(async () => {
      const [categories, products] = await Promise.all([
        fetchAll(() => supabase.from('categories').select('*').order('name')),
        fetchAll(() => supabase.from('products').select('category_id').neq('status', 'INACTIVE')),
      ]);
      const counts = {};
      products.forEach((p) => { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
      const data = categories.map((c) => ({ ...toCamel(c), productCount: counts[c.category_id] || 0 }));
      return { success: true, data };
    });
  },

  async saveCategory(catData) {
    return run(async () => {
      const fields = {
        name: catData.name,
        description: catData.description || '',
        status: catData.status || 'ACTIVE',
        updated_at: new Date().toISOString(),
      };
      if (catData.categoryId) {
        const row = check(await supabase.from('categories').update(fields).eq('category_id', catData.categoryId).select().single());
        return { success: true, data: toCamel(row), message: 'Category updated' };
      }
      const row = check(await supabase.from('categories').insert({ ...fields, status: 'ACTIVE' }).select().single());
      return { success: true, data: toCamel(row), message: 'Category created' };
    });
  },

  async deleteCategory(categoryId, permanent = false) {
    return run(async () => {
      if (permanent) {
        check(await supabase.from('categories').delete().eq('category_id', categoryId));
        return { success: true, message: 'Category permanently deleted' };
      }
      check(await supabase.from('categories')
        .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
        .eq('category_id', categoryId));
      return { success: true, message: 'Category deactivated' };
    });
  },

  // ----- sales -----

  async createSale(saleData) {
    return run(async () => {
      const result = await rpc('create_sale', { p: saleData });
      return { success: true, message: 'Sale completed successfully', data: toCamel(result) };
    });
  },

  async cancelSale(data) {
    return run(async () => {
      const message = await rpc('cancel_sale', {
        p_sale_id: data.saleId,
        p_reason: data.reason || '',
        p_authorized_by: data.authorizedBy || 'Manager',
      });
      return { success: true, message };
    });
  },

  async getSales(params = {}) {
    return run(async () => {
      const rows = await fetchAll(() => {
        let q = supabase.from('sales').select('*');
        if (params.status) q = q.eq('status', params.status);
        if (params.paymentMethod) q = q.eq('payment_method', params.paymentMethod);
        if (params.startDate && params.endDate) {
          q = q.gte('date', localDayStartIso(params.startDate)).lt('date', localNextDayStartIso(params.endDate));
        }
        return q.order('date', { ascending: false }).order('sale_id');
      });
      return { success: true, data: toCamel(rows) };
    });
  },

  async getSaleDetails(saleId) {
    return run(async () => {
      const [sale, items] = await Promise.all([
        supabase.from('sales').select('*').eq('sale_id', saleId).maybeSingle().then(check),
        supabase.from('sale_items').select('*').eq('sale_id', saleId).order('created_at').then(check),
      ]);
      if (!sale) return { success: false, error: 'Sale not found' };
      return { success: true, data: { sale: toCamel(sale), items: toCamel(items) } };
    });
  },

  // Today's bills for one counter cashier (database only returns a cashier's own bills)
  async getCashierSummary(cashierId) {
    return run(async () => {
      let q = supabase.from('sales').select('*').gte('date', localDayStartIso(localDateStr(new Date())));
      if (cashierId) q = q.eq('cashier_id', cashierId);
      const rows = check(await q.order('date', { ascending: false }));
      return { success: true, data: buildCashierSummary(toCamel(rows), cashierId) };
    });
  },

  // ----- purchases & suppliers -----

  async getPurchases() {
    return run(async () => {
      const rows = await fetchAll(() =>
        supabase.from('purchases').select('*, items:purchase_items(*)').order('date', { ascending: false }).order('purchase_id')
      );
      return { success: true, data: toCamel(rows) };
    });
  },

  async createPurchase(purchaseData) {
    return run(async () => {
      const row = await rpc('create_purchase', { p: purchaseData });
      return { success: true, data: toCamel(row), message: 'Purchase order created successfully' };
    });
  },

  async confirmPurchase(purchaseId) {
    return run(async () => {
      const message = await rpc('confirm_purchase', { p_purchase_id: purchaseId });
      return { success: true, message };
    });
  },

  async getSuppliers() {
    return run(async () => {
      const rows = await fetchAll(() => supabase.from('suppliers').select('*').order('name'));
      return { success: true, data: toCamel(rows) };
    });
  },

  async saveSupplier(suppData) {
    return run(async () => {
      const fields = {
        name: suppData.name,
        contact_person: suppData.contactPerson || '',
        phone: suppData.phone || '',
        email: suppData.email || '',
        address: suppData.address || '',
        status: suppData.status || 'ACTIVE',
        updated_at: new Date().toISOString(),
      };
      if (suppData.supplierId) {
        const row = check(await supabase.from('suppliers').update(fields).eq('supplier_id', suppData.supplierId).select().single());
        return { success: true, data: toCamel(row), message: 'Supplier updated' };
      }
      const row = check(await supabase.from('suppliers')
        .insert({ ...fields, status: 'ACTIVE', outstanding_balance: num(suppData.outstandingBalance) })
        .select().single());
      return { success: true, data: toCamel(row), message: 'Supplier created' };
    });
  },

  async recordSupplierPayment(data) {
    return run(async () => {
      const newBal = await rpc('record_supplier_payment', {
        p_supplier_id: data.supplierId,
        p_amount: num(data.amount),
        p_reference: data.reference || '',
      });
      return { success: true, message: `Supplier payment recorded. New balance: ${num(newBal)}` };
    });
  },

  // ----- customers -----

  async getCustomers() {
    return run(async () => {
      const rows = await fetchAll(() => supabase.from('customers').select('*').order('name'));
      return { success: true, data: toCamel(rows) };
    });
  },

  async saveCustomer(custData) {
    return run(async () => {
      const fields = {
        name: custData.name,
        phone: custData.phone || '',
        email: custData.email || '',
        address: custData.address || '',
        credit_limit: num(custData.creditLimit, 10000),
        notes: custData.notes || '',
        status: custData.status || 'ACTIVE',
        updated_at: new Date().toISOString(),
      };
      if (custData.customerId) {
        const row = check(await supabase.from('customers').update(fields).eq('customer_id', custData.customerId).select().single());
        return { success: true, data: toCamel(row), message: 'Customer updated' };
      }
      const row = check(await supabase.from('customers')
        .insert({ ...fields, status: 'ACTIVE', outstanding_balance: 0 })
        .select().single());
      return { success: true, data: toCamel(row), message: 'Customer created' };
    });
  },

  async recordCustomerPayment(data) {
    return run(async () => {
      const newBal = await rpc('record_customer_payment', {
        p_customer_id: data.customerId,
        p_amount: num(data.amount),
      });
      return { success: true, message: `Customer payment recorded. Remaining balance: ${num(newBal)}` };
    });
  },

  // ----- expenses -----

  async getExpenses(params = {}) {
    return run(async () => {
      const rows = await fetchAll(() => {
        let q = supabase.from('expenses').select('*');
        if (params.startDate && params.endDate) q = q.gte('date', params.startDate).lte('date', params.endDate);
        return q.order('date', { ascending: false }).order('created_at', { ascending: false });
      });
      return { success: true, data: toCamel(rows) };
    });
  },

  async saveExpense(data) {
    return run(async () => {
      const fields = {
        title: data.title,
        category: data.category || 'MISCELLANEOUS',
        amount: num(data.amount),
        date: data.date || localDateStr(new Date()),
        payment_method: data.paymentMethod || 'CASH',
        reference: data.reference || '',
        notes: data.notes || '',
        created_by: data.createdBy || 'Admin',
      };
      const row = data.expenseId
        ? check(await supabase.from('expenses').update(fields).eq('expense_id', data.expenseId).select().single())
        : check(await supabase.from('expenses').insert(fields).select().single());
      return { success: true, data: toCamel(row), message: 'Expense recorded' };
    });
  },

  async deleteExpense(expenseId) {
    return run(async () => {
      check(await supabase.from('expenses').delete().eq('expense_id', expenseId));
      return { success: true, message: 'Expense deleted' };
    });
  },

  // ----- stock movements & reports -----

  async getStockMovements(params = {}) {
    return run(async () => {
      let q = supabase.from('stock_movements').select('*');
      if (params.productId) q = q.eq('product_id', params.productId);
      const rows = check(await q.order('created_at', { ascending: false }).limit(200));
      return { success: true, data: toCamel(rows) };
    });
  },

  async getReports(params = {}) {
    return run(async () => {
      const today = new Date();
      const monthAgo = new Date(today.getTime() - 30 * 86400000);
      const data = await rpc('report_stats', {
        p_start: params.startDate || localDateStr(monthAgo),
        p_end: params.endDate || localDateStr(today),
        p_tz: TIME_ZONE,
      });
      return { success: true, data };
    });
  },

  // ----- settings -----

  async getSettings() {
    return run(async () => {
      const rows = check(await supabase.from('settings').select('key, value'));
      const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { success: true, data: { ...DEFAULT_SETTINGS, ...stored } };
    });
  },

  async saveSettings(settingsData) {
    return run(async () => {
      const now = new Date().toISOString();
      const rows = Object.entries(settingsData).map(([key, value]) => ({
        key,
        value: textOr(value),
        updated_at: now,
      }));
      check(await supabase.from('settings').upsert(rows, { onConflict: 'key' }));
      return { success: true, message: 'Settings saved successfully' };
    });
  },

  // ----- staff users -----

  async getUsers() {
    return run(async () => {
      const rows = check(await supabase.from('profiles').select('*').order('created_at'));
      return { success: true, data: rows.map(mapUser) };
    });
  },

  async saveUser(userData) {
    return run(async () => {
      const row = await rpc('admin_save_user', {
        p_user_id: userData.userId || null,
        p_username: userData.username || '',
        p_full_name: userData.fullName || '',
        p_role: userData.role || 'CASHIER',
        p_email: userData.email || '',
        p_password: userData.password || '',
        p_status: userData.status || 'ACTIVE',
      });
      return { success: true, data: mapUser(row), message: userData.userId ? 'User updated' : 'New user created' };
    });
  },

  async deleteUser(userId) {
    return run(async () => {
      await rpc('admin_delete_user', { p_user_id: userId });
      return { success: true, message: 'User deleted' };
    });
  },

  // Local demo storage helpers (do not touch the Supabase database)
  resetLocalDatabase: () => mockDataService.resetToDefaults(),
  clearAllDummyData: () => mockDataService.clearAllDummyData(),
};
