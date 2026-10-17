/**
 * Supabase Backend Service (the only API layer).
 * Every method resolves to { success, data, error } (plus `count` for paged lists).
 *
 * Database columns are snake_case; the app uses camelCase. Rows are
 * converted here. Money and stock writes run as Postgres functions defined in
 * supabase/schema.sql, which compute prices and balances on the server.
 */

import { supabase } from './supabaseClient';
import { buildCashierSummary } from '../utils/cashierSummary';
import { dayStartIso, nextDayStartIso, todayStr, addDays, setStoreTimeZone } from '../utils/dates';

// Staff usernames map to Supabase Auth emails (must match schema.sql)
const AUTH_EMAIL_DOMAIN = 'grocery.local';
const PAGE_SIZE = 1000;

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

// Friendly messages for database constraint errors
const CONSTRAINT_MESSAGES = {
  customers_phone_digits_key: 'A customer with this phone number already exists',
  products_sku_key: 'This SKU is already used by another product',
  products_barcode_key: 'This barcode is already used by another product',
  expense_categories_code_key: 'An expense category with this code already exists',
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

function friendly(message) {
  for (const [key, msg] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(key)) return msg;
  }
  return message;
}

function check({ data, error }) {
  if (error) throw new Error(friendly(error.message));
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

// Server-side page: { data, count }
async function page(query, { page: pg = 1, pageSize = 20 } = {}) {
  const from = (Math.max(1, pg) - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(friendly(error.message));
  return { success: true, data: toCamel(data || []), count: count || 0 };
}

// Strip characters that would break a PostgREST or() filter
const cleanSearch = (s) => String(s || '').trim().replace(/[,()*%\\]/g, ' ').trim();

// Run a handler and convert thrown errors into { success: false, error }.
// "APPROVAL_REQUIRED: reason" from the database sets needsApproval.
async function run(fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = err.message || 'Database request failed';
    const m = msg.match(/APPROVAL_REQUIRED:\s*(.*)$/);
    if (m) return { success: false, needsApproval: true, error: m[1] };
    console.error('Supabase request failed:', err);
    return { success: false, error: msg };
  }
}

function mapUser(profile) {
  if (!profile) return null;
  return {
    userId: profile.id,
    username: profile.username,
    fullName: profile.full_name || profile.username,
    role: profile.role || 'CASHIER',
    email: profile.email || '',
    status: profile.status || 'ACTIVE',
    createdAt: profile.created_at,
    lastLoginAt: profile.last_login_at || null,
    mustChangePassword: Boolean(profile.must_change_password),
    permissions: profile.permissions || {},
    effectivePermissions: profile.effective_permissions || null,
    hasManagerPin: Boolean(profile.has_manager_pin),
  };
}

function dateRange(q, column, startDate, endDate) {
  if (startDate) q = q.gte(column, dayStartIso(startDate));
  if (endDate) q = q.lt(column, nextDayStartIso(endDate));
  return q;
}

// ---------- service ----------

export const supabaseService = {
  backendName: 'Supabase',

  // ----- auth -----

  async login(username, password) {
    return run(async () => {
      const uname = String(username || '').trim().toLowerCase();
      const email = uname.includes('@') ? uname : `${uname}@${AUTH_EMAIL_DOMAIN}`;

      const { error } = await supabase.auth.signInWithPassword({ email, password: String(password || '') });
      if (error) {
        const msg = /invalid login credentials/i.test(error.message) ? 'Invalid username or password' : error.message;
        return { success: false, error: msg };
      }
      try {
        const profile = await rpc('record_login');
        if (!profile || profile.status !== 'ACTIVE') throw new Error('This user account is inactive. Contact the store manager.');
        return { success: true, user: mapUser(profile) };
      } catch (e) {
        await supabase.auth.signOut();
        return { success: false, error: /no active staff profile/i.test(e.message)
          ? 'No active staff profile for this account. Ask the store manager.' : e.message };
      }
    });
  },

  async logout() {
    await supabase.auth.signOut();
  },

  // Returns the signed-in staff user, or null if there is no valid session
  async getCurrentUser() {
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.user) return null;
    const { data: profile, error } = await supabase.rpc('my_profile');
    if (error) return undefined; // network problem: keep the cached user
    return profile ? mapUser(profile) : null;
  },

  async changeOwnPassword(oldPassword, newPassword) {
    return run(async () => {
      await rpc('change_own_password', { p_old: oldPassword, p_new: newPassword });
      return { success: true, message: 'Password changed' };
    });
  },

  async verifyOwnPassword(password) {
    return run(async () => ({ success: true, data: Boolean(await rpc('verify_own_password', { p_password: password })) }));
  },

  async setManagerPin(pin) {
    return run(async () => {
      await rpc('set_manager_pin', { p_pin: pin });
      return { success: true, message: 'Manager PIN saved' };
    });
  },

  // { success, data: { token, approvedBy, expiresAt } }
  async verifyManagerPin(pin) {
    return run(async () => {
      const res = await rpc('verify_manager_pin', { p_pin: String(pin || '') });
      if (!res?.success) return { success: false, error: res?.error || 'Wrong manager PIN' };
      return { success: true, data: res };
    });
  },

  async getPublicStoreInfo() {
    return run(async () => ({ success: true, data: (await rpc('public_store_info')) || {} }));
  },

  // ----- dashboard & initial load -----

  async getDashboardStats() {
    return run(async () => {
      const raw = await rpc('dashboard_stats');
      const { dailySales = {}, recentSales = [], ...rest } = raw || {};
      const today = todayStr();
      const weeklySalesTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = addDays(today, -i);
        const d = new Date(`${date}T12:00:00Z`);
        weeklySalesTrend.push({
          date,
          label: d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }),
          sales: num(dailySales[date]),
        });
      }
      return { success: true, data: { ...rest, recentSales: toCamel(recentSales), weeklySalesTrend } };
    });
  },

  async getInitialStoreData({ isAdmin = false } = {}) {
    return run(async () => {
      const [productsRes, categoriesRes, settingsRes, usersRes, statsRes] = await Promise.all([
        this.getProducts(),
        this.getCategories(),
        this.getSettings(),
        isAdmin ? this.getUsers() : Promise.resolve({ success: true, data: [] }),
        isAdmin ? this.getDashboardStats() : Promise.resolve({ success: true, data: null }),
      ]);
      const failed = [productsRes, categoriesRes, settingsRes].find((r) => !r.success);
      if (failed) return failed;
      return {
        success: true,
        data: {
          products: productsRes.data,
          categories: categoriesRes.data,
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
        fetchAll(() => supabase.from('products').select('*').order('name').order('product_id')),
        fetchAll(() => supabase.from('categories').select('category_id, name')),
      ]);
      const catMap = Object.fromEntries(categories.map((c) => [c.category_id, c.name]));
      return { success: true, data: products.map((p) => ({ ...toCamel(p), categoryName: catMap[p.category_id] || 'General' })) };
    });
  },

  // Live stock updates from other counters. Returns an unsubscribe function.
  subscribeProducts(onChange) {
    const channel = supabase
      .channel('products-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        onChange({
          type: payload.eventType,
          product: payload.new && Object.keys(payload.new).length ? toCamel(payload.new) : null,
          oldId: payload.old?.product_id,
        });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  async saveProduct(productData) {
    return run(async () => {
      const id = productData.productId && !String(productData.productId).startsWith('PROD-TEMP-') ? productData.productId : null;
      const row = await rpc('save_product', {
        p: {
          productId: id,
          name: productData.name,
          sku: productData.sku || '',
          barcode: textOr(productData.barcode),
          categoryId: productData.categoryId || '',
          unit: productData.unit || 'piece',
          costPrice: num(productData.costPrice),
          sellingPrice: num(productData.sellingPrice),
          minimumStock: num(productData.minimumStock, 5),
          expiryDate: productData.expiryDate || '',
          status: productData.status || 'ACTIVE',
          currentStock: num(productData.currentStock),
        },
      });
      return { success: true, data: toCamel(row), message: id ? 'Product updated successfully' : 'Product created successfully' };
    });
  },

  async deleteProduct(productId, permanent = false) {
    return run(async () => {
      const message = await rpc('delete_product', { p_product_id: productId, p_permanent: Boolean(permanent) });
      return { success: true, message };
    });
  },

  async adjustStock(data) {
    return run(async () => {
      const currentStock = await rpc('adjust_stock', {
        p_product_id: data.productId,
        p_adjustment_type: data.adjustmentType,
        p_quantity: num(data.quantity),
        p_reason: data.reason || '',
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
      return { success: true, data: categories.map((c) => ({ ...toCamel(c), productCount: counts[c.category_id] || 0 })) };
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

  /**
   * Only ids, quantities and discounts are sent. The database reads prices,
   * applies discount then tax, and checks stock, limits and khata.
   */
  async createSale({ customerId, items, discount, payments, notes, approvalToken }) {
    return run(async () => {
      const result = await rpc('create_sale', {
        p: {
          customerId: customerId || 'WALK-IN',
          items: (items || []).map((i) => ({ productId: i.productId, quantity: num(i.quantity), discount: num(i.discount) })),
          discount: num(discount),
          payments: (payments || []).map((t) => ({ method: t.method, amount: num(t.amount), reference: t.reference || '' })),
          notes: notes || '',
          approvalToken: approvalToken || null,
        },
      });
      return { success: true, message: 'Sale completed successfully', data: toCamel(result) };
    });
  },

  async cancelSale({ saleId, reason, refundMethod }) {
    return run(async () => {
      const message = await rpc('cancel_sale', { p_sale_id: saleId, p_reason: reason || '', p_refund_method: refundMethod || 'CASH' });
      return { success: true, message };
    });
  },

  async returnSaleItems({ saleId, items, reason, refundMethod, approvalToken }) {
    return run(async () => {
      const data = await rpc('return_sale_items', {
        p_sale_id: saleId,
        p_items: items.map((i) => ({ saleItemId: i.saleItemId, qty: num(i.qty) })),
        p_reason: reason || '',
        p_refund_method: refundMethod || 'CASH',
        p_approval_token: approvalToken || null,
      });
      return { success: true, data: toCamel(data), message: 'Return recorded and stock restored' };
    });
  },

  async getSales(params = {}) {
    return run(async () => {
      let q = supabase.from('sales').select('*', { count: 'exact' });
      if (params.status === 'RETURNED') q = q.gt('returned_total', 0).eq('status', 'COMPLETED');
      else if (params.status) q = q.eq('status', params.status);
      if (params.paymentMethod) q = q.eq('payment_method', params.paymentMethod);
      if (params.cashierId) q = q.eq('cashier_id', params.cashierId);
      if (params.customerId) q = q.eq('customer_id', params.customerId);
      q = dateRange(q, 'date', params.startDate, params.endDate);
      const s = cleanSearch(params.search);
      if (s) q = q.or(`invoice_number.ilike.*${s}*,customer_name.ilike.*${s}*,cashier_name.ilike.*${s}*`);
      q = q.order('date', { ascending: false }).order('sale_id');
      if (params.all) {
        const rows = check(await q.limit(5000));
        return { success: true, data: toCamel(rows) };
      }
      return page(q, params);
    });
  },

  async getSaleDetails(saleId) {
    return run(async () => ({ success: true, data: toCamel(await rpc('get_sale_details', { p_sale_id: saleId })) }));
  },

  // Today's bills for one counter cashier (database only returns a cashier's own bills)
  async getCashierSummary(cashierId) {
    return run(async () => {
      let q = supabase.from('sales').select('*').gte('date', dayStartIso(todayStr()));
      if (cashierId) q = q.eq('cashier_id', cashierId);
      const rows = check(await q.order('date', { ascending: false }).limit(1000));
      return { success: true, data: buildCashierSummary(toCamel(rows), cashierId) };
    });
  },

  // ----- shifts -----

  async getCurrentShift() {
    return run(async () => ({ success: true, data: await rpc('current_shift') }));
  },

  async openShift(openingCash, notes = '') {
    return run(async () => ({ success: true, data: await rpc('open_shift', { p_opening_cash: num(openingCash), p_notes: notes }), message: 'Shift opened' }));
  },

  async closeShift({ shiftId, countedCash, notes }) {
    return run(async () => ({
      success: true,
      data: await rpc('close_shift', { p_shift_id: shiftId || null, p_counted_cash: num(countedCash), p_notes: notes || '' }),
      message: 'Shift closed',
    }));
  },

  async getShiftSummary(shiftId) {
    return run(async () => ({ success: true, data: await rpc('shift_summary', { p_shift_id: shiftId }) }));
  },

  async listShifts(startDate, endDate) {
    return run(async () => ({ success: true, data: toCamel(await rpc('list_shifts', { p_start: startDate, p_end: endDate })) }));
  },

  // ----- held bills -----

  async getHeldBills() {
    return run(async () => {
      const rows = check(await supabase.from('held_bills').select('*').order('created_at', { ascending: false }).limit(100));
      return { success: true, data: toCamel(rows) };
    });
  },

  async holdBill({ cart, customer, billDiscount, note }) {
    return run(async () => {
      const row = check(await supabase.from('held_bills')
        .insert({ cart, customer: customer || {}, bill_discount: num(billDiscount), note: note || '' })
        .select().single());
      return { success: true, data: toCamel(row), message: 'Bill put on hold' };
    });
  },

  async deleteHeldBill(holdId) {
    return run(async () => {
      check(await supabase.from('held_bills').delete().eq('hold_id', holdId));
      return { success: true };
    });
  },

  // ----- purchases & suppliers -----

  async getPurchases(params = {}) {
    return run(async () => {
      let q = supabase.from('purchases').select('*, items:purchase_items(*)', { count: 'exact' });
      if (params.status) q = q.eq('status', params.status);
      if (params.supplierId) q = q.eq('supplier_id', params.supplierId);
      const s = cleanSearch(params.search);
      if (s) q = q.or(`purchase_number.ilike.*${s}*,supplier_name.ilike.*${s}*`);
      q = q.order('date', { ascending: false }).order('purchase_id');
      return page(q, params);
    });
  },

  async createPurchase(purchaseData) {
    return run(async () => {
      const row = await rpc('create_purchase', { p: purchaseData });
      return { success: true, data: toCamel(row), message: 'Purchase order created successfully' };
    });
  },

  async updatePurchase(purchaseId, purchaseData) {
    return run(async () => {
      const row = await rpc('update_purchase', { p_purchase_id: purchaseId, p: purchaseData });
      return { success: true, data: toCamel(row), message: 'Purchase order updated' };
    });
  },

  async cancelPurchase(purchaseId, reason) {
    return run(async () => ({ success: true, message: await rpc('cancel_purchase', { p_purchase_id: purchaseId, p_reason: reason || '' }) }));
  },

  // items: [{ purchaseItemId, qty }] or null for everything still due
  async receivePurchase(purchaseId, items = null) {
    return run(async () => {
      const data = await rpc('receive_purchase', { p_purchase_id: purchaseId, p_items: items });
      return { success: true, data, message: data.status === 'RECEIVED' ? 'Order fully received' : 'Partial delivery received' };
    });
  },

  async confirmPurchase(purchaseId) {
    return this.receivePurchase(purchaseId, null);
  },

  async returnPurchase(purchaseId, items, reason) {
    return run(async () => ({
      success: true,
      data: await rpc('return_purchase', { p_purchase_id: purchaseId, p_items: items, p_reason: reason || '' }),
      message: 'Goods returned to supplier',
    }));
  },

  async getSuppliers() {
    return run(async () => {
      const rows = check(await supabase.from('suppliers').select('*').order('name').limit(5000));
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
      const row = await rpc('record_supplier_payment', {
        p_supplier_id: data.supplierId,
        p_amount: num(data.amount),
        p_reference: data.reference || '',
        p_purchase_id: data.purchaseId || null,
        p_method: data.method || 'CASH',
      });
      return { success: true, data: toCamel(row), message: `Supplier payment recorded. New balance: ${num(row?.balance_after)}` };
    });
  },

  async getSupplierLedger(supplierId, { startDate, endDate } = {}) {
    return run(async () => {
      let q = supabase.from('supplier_ledger').select('*').eq('supplier_id', supplierId);
      q = dateRange(q, 'created_at', startDate, endDate);
      const rows = check(await q.order('created_at').order('entry_id').limit(5000));
      return { success: true, data: toCamel(rows) };
    });
  },

  // ----- customers -----

  async getCustomers(params = {}) {
    return run(async () => {
      let q = supabase.from('customers').select('*', { count: 'exact' }).neq('customer_id', 'WALK-IN');
      const s = cleanSearch(params.search);
      if (s) {
        const digits = s.replace(/\D/g, '');
        q = q.or([`name.ilike.*${s}*`, `customer_id.ilike.*${s}*`, digits ? `phone_digits.like.*${digits}*` : null].filter(Boolean).join(','));
      }
      if (params.filter === 'OWING') q = q.gt('outstanding_balance', 0);
      if (params.filter === 'ADVANCE') q = q.lt('outstanding_balance', 0);
      if (params.status) q = q.eq('status', params.status);
      q = params.filter === 'OWING' ? q.order('outstanding_balance', { ascending: false }) : q.order('name');
      return page(q.order('customer_id'), params);
    });
  },

  // POS lookup: walk-in first, then up to 20 matches
  async searchCustomers(term) {
    return run(async () => {
      const res = await this.getCustomers({ search: term, status: 'ACTIVE', page: 1, pageSize: 20 });
      if (!res.success) return res;
      return { success: true, data: res.data };
    });
  },

  async getCustomer(customerId) {
    return run(async () => {
      const row = check(await supabase.from('customers').select('*').eq('customer_id', customerId).maybeSingle());
      return { success: true, data: toCamel(row) };
    });
  },

  async saveCustomer(custData) {
    return run(async () => {
      const fields = {
        name: custData.name,
        phone: custData.phone || '',
        email: custData.email || '',
        address: custData.address || '',
        credit_limit: num(custData.creditLimit, 0),
        notes: custData.notes || '',
        status: custData.status || 'ACTIVE',
        updated_at: new Date().toISOString(),
      };
      if (custData.customerId) {
        const row = check(await supabase.from('customers').update(fields).eq('customer_id', custData.customerId).select().single());
        return { success: true, data: toCamel(row), message: 'Customer updated' };
      }
      const row = check(await supabase.from('customers')
        .insert({ ...fields, status: 'ACTIVE', outstanding_balance: num(custData.openingBalance) })
        .select().single());
      return { success: true, data: toCamel(row), message: 'Customer created' };
    });
  },

  async recordCustomerPayment(data) {
    return run(async () => {
      const row = await rpc('record_customer_payment', {
        p_customer_id: data.customerId,
        p_amount: num(data.amount),
        p_method: data.method || 'CASH',
        p_notes: data.notes || '',
        p_reference: data.reference || '',
      });
      const entry = toCamel(row);
      return { success: true, data: entry, message: `Customer payment recorded. Remaining balance: ${num(entry.balanceAfter)}` };
    });
  },

  async adjustCustomerBalance(customerId, amount, notes) {
    return run(async () => ({
      success: true,
      data: toCamel(await rpc('adjust_customer_balance', { p_customer_id: customerId, p_amount: num(amount), p_notes: notes })),
      message: 'Balance adjusted',
    }));
  },

  async getCustomerLedger(customerId, { startDate, endDate } = {}) {
    return run(async () => {
      let q = supabase.from('customer_ledger').select('*').eq('customer_id', customerId);
      q = dateRange(q, 'created_at', startDate, endDate);
      const rows = check(await q.order('created_at').order('entry_id').limit(5000));
      return { success: true, data: toCamel(rows) };
    });
  },

  async getCustomerAging() {
    return run(async () => ({ success: true, data: (await rpc('customer_aging')) || [] }));
  },

  // ----- expenses -----

  async getExpenses(params = {}) {
    return run(async () => {
      let q = supabase.from('expenses').select('*');
      if (params.startDate) q = q.gte('date', params.startDate);
      if (params.endDate) q = q.lte('date', params.endDate);
      if (params.status) q = q.eq('status', params.status);
      const rows = check(await q.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5000));
      return { success: true, data: toCamel(rows) };
    });
  },

  async saveExpense(data) {
    return run(async () => {
      const fields = {
        title: data.title,
        category: data.category || 'MISCELLANEOUS',
        amount: num(data.amount),
        date: data.date || todayStr(),
        payment_method: data.paymentMethod || 'CASH',
        reference: data.reference || '',
        notes: data.notes || '',
        paid_from_drawer: Boolean(data.paidFromDrawer),
      };
      const row = data.expenseId
        ? check(await supabase.from('expenses').update(fields).eq('expense_id', data.expenseId).select().single())
        : check(await supabase.from('expenses').insert(fields).select().single());
      return { success: true, data: toCamel(row), message: data.expenseId ? 'Expense updated' : 'Expense recorded' };
    });
  },

  async voidExpense(expenseId, reason) {
    return run(async () => {
      await rpc('void_expense', { p_expense_id: expenseId, p_reason: reason || '' });
      return { success: true, message: 'Expense voided' };
    });
  },

  async getExpenseCategories() {
    return run(async () => {
      const rows = check(await supabase.from('expense_categories').select('*').order('sort_order').order('name'));
      return { success: true, data: toCamel(rows) };
    });
  },

  async saveExpenseCategory(cat) {
    return run(async () => {
      const fields = { name: cat.name, status: cat.status || 'ACTIVE', sort_order: num(cat.sortOrder, 100) };
      if (cat.categoryId) {
        const row = check(await supabase.from('expense_categories').update(fields).eq('category_id', cat.categoryId).select().single());
        return { success: true, data: toCamel(row), message: 'Category updated' };
      }
      const code = String(cat.code || cat.name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
      const row = check(await supabase.from('expense_categories').insert({ ...fields, code }).select().single());
      return { success: true, data: toCamel(row), message: 'Category added' };
    });
  },

  // ----- stock movements & counts -----

  async getStockMovements(params = {}) {
    return run(async () => {
      let q = supabase.from('stock_movements').select('*', { count: 'exact' });
      if (params.productId) q = q.eq('product_id', params.productId);
      if (params.type) q = q.eq('movement_type', params.type);
      q = dateRange(q, 'created_at', params.startDate, params.endDate);
      q = q.order('created_at', { ascending: false }).order('movement_id');
      return page(q, params);
    });
  },

  async getStockCounts() {
    return run(async () => {
      const rows = check(await supabase.from('stock_counts').select('*').order('created_at', { ascending: false }).limit(200));
      return { success: true, data: toCamel(rows) };
    });
  },

  async getStockCount(countId) {
    return run(async () => {
      const [count, items] = await Promise.all([
        supabase.from('stock_counts').select('*').eq('count_id', countId).single().then(check),
        fetchAll(() => supabase.from('stock_count_items').select('*').eq('count_id', countId).order('product_name')),
      ]);
      return { success: true, data: { count: toCamel(count), items: toCamel(items) } };
    });
  },

  async startStockCount(categoryId, notes) {
    return run(async () => ({
      success: true,
      data: toCamel(await rpc('start_stock_count', { p_category_id: categoryId || null, p_notes: notes || '' })),
      message: 'Stock count started',
    }));
  },

  // items: [{ itemId, countedQty }]  (countedQty '' = not counted)
  async saveStockCountItems(items) {
    return run(async () => {
      const now = new Date().toISOString();
      for (let i = 0; i < items.length; i += 25) {
        await Promise.all(items.slice(i, i + 25).map((it) =>
          supabase.from('stock_count_items')
            .update({ counted_qty: it.countedQty === '' || it.countedQty === null ? null : num(it.countedQty), updated_at: now })
            .eq('item_id', it.itemId)
            .then(check)));
      }
      return { success: true, message: 'Counts saved' };
    });
  },

  async applyStockCount(countId) {
    return run(async () => ({ success: true, data: await rpc('apply_stock_count', { p_count_id: countId }), message: 'Stock updated from count' }));
  },

  async cancelStockCount(countId) {
    return run(async () => {
      await rpc('cancel_stock_count', { p_count_id: countId });
      return { success: true, message: 'Stock count cancelled' };
    });
  },

  // ----- reports -----

  async getReports(params = {}) {
    return run(async () => {
      const end = params.endDate || todayStr();
      const start = params.startDate || addDays(end, -29);
      return { success: true, data: await rpc('report_stats', { p_start: start, p_end: end }) };
    });
  },

  async getDailyClosing(date) {
    return run(async () => ({ success: true, data: await rpc('report_daily_closing', { p_date: date || todayStr() }) }));
  },

  async getSlowMoving(days = 30) {
    return run(async () => ({ success: true, data: (await rpc('report_slow_moving', { p_days: num(days, 30) })) || [] }));
  },

  async getExpiryReport(days = null) {
    return run(async () => ({ success: true, data: (await rpc('report_expiry', { p_days: days === null ? null : num(days) })) || [] }));
  },

  // ----- settings -----

  async getSettings() {
    return run(async () => {
      const rows = check(await supabase.from('settings').select('key, value'));
      const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const data = { ...DEFAULT_SETTINGS, ...stored };
      setStoreTimeZone(data.timezone);
      return { success: true, data };
    });
  },

  async saveSettings(settingsData) {
    return run(async () => {
      const now = new Date().toISOString();
      const rows = Object.entries(settingsData).map(([key, value]) => ({ key, value: textOr(value), updated_at: now }));
      check(await supabase.from('settings').upsert(rows, { onConflict: 'key' }));
      setStoreTimeZone(settingsData.timezone);
      return { success: true, message: 'Settings saved successfully' };
    });
  },

  // ----- staff users -----

  async getUsers() {
    return run(async () => {
      const rows = check(await supabase.from('profiles')
        .select('id, username, full_name, role, email, status, created_at, last_login_at, must_change_password, permissions')
        .order('created_at'));
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
        p_permissions: userData.permissions || null,
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

  // ----- audit log -----

  async getAuditLogs(params = {}) {
    return run(async () => {
      let q = supabase.from('audit_logs').select('*', { count: 'exact' });
      if (params.userId) q = q.eq('user_id', params.userId);
      if (params.action) q = q.eq('action', params.action);
      if (params.entity) q = q.eq('entity', params.entity);
      const s = cleanSearch(params.search);
      if (s) q = q.or(`entity_id.ilike.*${s}*,user_name.ilike.*${s}*`);
      q = dateRange(q, 'created_at', params.startDate, params.endDate);
      return page(q.order('created_at', { ascending: false }).order('log_id'), params);
    });
  },
};
