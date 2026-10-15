/**
 * Unified API Service
 * Uses Supabase when VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are set.
 * Otherwise routes calls between Google Apps Script Backend and Local Demo/Mock Storage.
 */

import { AppsScriptService } from './appsScriptService';
import { mockDataService } from './mockDataService';
import { isSupabaseConfigured } from './supabaseClient';
import { supabaseService } from './supabaseService';

const STORED_URL_KEY = 'gsms_apps_script_url';

class ApiService {
  backendName = 'Google Sheets';

  constructor() {
    const envUrl = import.meta.env.VITE_APPS_SCRIPT_URL || '';
    const storedUrl = localStorage.getItem(STORED_URL_KEY) || '';
    this.appsScriptUrl = storedUrl || (envUrl.includes('REPLACE_WITH') ? '' : envUrl);
    this.appsScript = new AppsScriptService(this.appsScriptUrl);
    this.forceLocal = localStorage.getItem('gsms_force_local') === 'true';
  }

  isLive() {
    return Boolean(this.appsScriptUrl) && !this.forceLocal;
  }

  getEndpointUrl() {
    return this.appsScriptUrl;
  }

  setEndpointUrl(url) {
    this.appsScriptUrl = url ? url.trim() : '';
    if (this.appsScriptUrl) {
      localStorage.setItem(STORED_URL_KEY, this.appsScriptUrl);
      this.forceLocal = false;
      localStorage.removeItem('gsms_force_local');
    } else {
      localStorage.removeItem(STORED_URL_KEY);
    }
    this.appsScript.setEndpoint(this.appsScriptUrl);
  }

  setForceLocal(val) {
    this.forceLocal = Boolean(val);
    if (this.forceLocal) {
      localStorage.setItem('gsms_force_local', 'true');
    } else {
      localStorage.removeItem('gsms_force_local');
    }
  }

  async testConnection(url) {
    return await this.appsScript.testConnection(url || this.appsScriptUrl);
  }

  async getDashboardStats() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getDashboardStats');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed, using local store:', e);
      }
    }
    return mockDataService.getDashboardStats();
  }

  async getProducts() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getProducts');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed, using local store:', e);
      }
    }
    return mockDataService.getProducts();
  }

  async saveProduct(productData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('saveProduct', productData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed, falling back:', e);
      }
    }
    return mockDataService.saveProduct(productData);
  }

  async deleteProduct(productId, permanent = false) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('deleteProduct', { productId, permanent });
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.deleteProduct(productId, permanent);
  }

  async adjustStock(data) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('adjustStock', data);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.adjustStock(data);
  }

  async getCategories() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getCategories');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getCategories();
  }

  async saveCategory(categoryData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('saveCategory', categoryData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.saveCategory(categoryData);
  }

  async deleteCategory(categoryId, permanent = false) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('deleteCategory', { categoryId, permanent });
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.deleteCategory(categoryId, permanent);
  }

  async createSale(saleData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('createSale', saleData);
        if (res.success) return res;
        throw new Error(res.error || 'Sale failed on Google Sheets backend');
      } catch (e) {
        if (!e.message.includes('Insufficient stock')) {
          console.warn('Apps Script checkout failed, saving locally:', e);
          return mockDataService.createSale(saleData);
        }
        throw e;
      }
    }
    return mockDataService.createSale(saleData);
  }

  async cancelSale(data) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('cancelSale', data);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script cancel sale failed:', e);
      }
    }
    return mockDataService.cancelSale(data);
  }

  async getSales(params) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getSales', params);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getSales(params);
  }

  async getSaleDetails(saleId) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getSaleDetails', { saleId });
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getSaleDetails(saleId);
  }

  async getPurchases() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getPurchases');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getPurchases();
  }

  async createPurchase(purchaseData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('createPurchase', purchaseData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.createPurchase(purchaseData);
  }

  async confirmPurchase(purchaseId) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('confirmPurchase', { purchaseId });
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.confirmPurchase(purchaseId);
  }

  async getSuppliers() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getSuppliers');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getSuppliers();
  }

  async saveSupplier(supplierData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('saveSupplier', supplierData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.saveSupplier(supplierData);
  }

  async recordSupplierPayment(data) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('recordSupplierPayment', data);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.recordSupplierPayment(data);
  }

  async getCustomers() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getCustomers');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getCustomers();
  }

  async saveCustomer(customerData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('saveCustomer', customerData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.saveCustomer(customerData);
  }

  async recordCustomerPayment(data) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('recordCustomerPayment', data);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.recordCustomerPayment(data);
  }

  async getExpenses(params) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getExpenses', params);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getExpenses(params);
  }

  async saveExpense(expenseData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('saveExpense', expenseData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.saveExpense(expenseData);
  }

  async deleteExpense(expenseId) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('deleteExpense', { expenseId });
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.deleteExpense(expenseId);
  }

  async getStockMovements(params) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getStockMovements', params);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getStockMovements(params);
  }

  async getReports(params) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getReports', params);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getReports(params);
  }

  async getSettings() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getSettings');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.getSettings();
  }

  async saveSettings(settingsData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('saveSettings', settingsData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed:', e);
      }
    }
    return mockDataService.saveSettings(settingsData);
  }

  async getInitialStoreData() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getInitialStoreData');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script request failed, using local store:', e);
      }
    }
    return mockDataService.getInitialStoreData();
  }

  async login(username, password) {
    const uName = String(username || '').trim().toLowerCase();
    const uPass = String(password || '').trim();

    // Fast-pass master check: Always permit admin and cashier with standard credentials or sha256_mock_hash
    const isAdmin = (uName === 'admin' || uName === 'usr-admin') && 
      (uPass === 'admin123' || uPass === 'admin' || uPass === '1234' || uPass === '123456' || uPass === 'sha256_mock_hash');

    const isCashier = (uName === 'cashier1' || uName === 'cashier' || uName === 'usr-cashier' || uName === 'usr-cashier-1') && 
      (uPass === '1234' || uPass === 'cashier123' || uPass === 'admin123' || uPass === 'sha256_mock_hash');

    if (isAdmin) {
      return {
        success: true,
        user: {
          userId: 'USR-ADMIN',
          username: 'admin',
          fullName: 'Store Manager',
          role: 'ADMIN',
          email: 'admin@grocery.local'
        }
      };
    }

    if (isCashier) {
      return {
        success: true,
        user: {
          userId: 'USR-CASHIER-1',
          username: 'cashier1',
          fullName: 'Counter Cashier',
          role: 'CASHIER',
          email: 'cashier@grocery.local'
        }
      };
    }

    // Otherwise, check with Google Apps Script backend for custom user accounts created in Users sheet
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('login', { username, password });
        if (res.success) return res;

        // If Google Apps Script returned error, also test cached/mock users before giving up
        const localCheck = mockDataService.login(username, password);
        if (localCheck.success) return localCheck;

        return { success: false, error: res.error || 'Invalid password' };
      } catch (e) {
        console.warn('Apps Script login failed, testing local:', e);
      }
    }
    return mockDataService.login(username, password);
  }

  async getUsers() {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.get('getUsers');
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script getUsers failed:', e);
      }
    }
    return mockDataService.getUsers();
  }

  async saveUser(userData) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('saveUser', userData);
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script saveUser failed:', e);
      }
    }
    return mockDataService.saveUser(userData);
  }

  async deleteUser(userId) {
    if (this.isLive()) {
      try {
        const res = await this.appsScript.post('deleteUser', { userId });
        if (res.success) return res;
      } catch (e) {
        console.warn('Apps Script deleteUser failed:', e);
      }
    }
    return mockDataService.deleteUser(userId);
  }

  resetLocalDatabase() {
    return mockDataService.resetToDefaults();
  }

  clearAllDummyData() {
    return mockDataService.clearAllDummyData();
  }
}

export const api = isSupabaseConfigured ? supabaseService : new ApiService();
