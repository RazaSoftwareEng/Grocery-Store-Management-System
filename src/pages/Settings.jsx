import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { useFormValidation, rules } from '../hooks/useFormValidation';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { Save, Store, Tags } from 'lucide-react';
import { ExpenseCategoriesSettings } from '../components/common/ExpenseCategoriesSettings';

const TIME_ZONES = ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Asia/Dhaka', 'Europe/London', 'America/New_York', 'UTC'];

export function Settings() {
  const { settings, refreshAllData } = useStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('general'); // 'general', 'expenses'

  // General Store Settings State
  const [formData, setFormData] = useState({
    storeName: settings.storeName || 'Bismillah Grocery & Supermarket',
    tagline: settings.tagline || 'Fresh Groceries & Everyday Essentials',
    phone: settings.phone || '+92 300 1234567',
    address: settings.address || 'Shop # 12, Commercial Market, Main Boulevard, Lahore',
    currency: settings.currency || 'PKR',
    currencySymbol: settings.currencySymbol || 'Rs.',
    taxRate: settings.taxRate || '0',
    lowStockDefaultThreshold: settings.lowStockDefaultThreshold || '5',
    allowNegativeStock: String(settings.allowNegativeStock || 'false'),
    receiptType: settings.receiptType || 'thermal80',
    receiptFooter: settings.receiptFooter || 'Thank you for shopping with us! Please come again.',
    timezone: settings.timezone || 'Asia/Karachi',
    cashierMaxDiscountPercent: settings.cashierMaxDiscountPercent ?? '10',
    expiryAlertDays: settings.expiryAlertDays ?? '30',
    autoLockMinutes: settings.autoLockMinutes ?? '15',
    ntn: settings.ntn || '',
    strn: settings.strn || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const v = useFormValidation(formData, {
    storeName: (val) => {
      const t = val.trim();
      if (!t) return 'Store name is required';
      return t.length > 60 ? 'Keep the store name under 60 characters' : '';
    },
    phone: rules.phone,
    currencySymbol: (val) => (!val.trim() ? 'Currency symbol is required' : ''),
    taxRate: (val) => {
      if (String(val).trim() === '') return 'Enter 0 if you do not charge tax';
      const n = Number(val);
      if (Number.isNaN(n)) return 'Numbers only';
      return n < 0 || n > 100 ? 'Tax rate must be between 0 and 100' : '';
    },
    lowStockDefaultThreshold: (val) =>
      String(val).trim() === '' || /^\d+$/.test(String(val).trim()) ? '' : 'Enter a whole number, 0 or more',
    receiptFooter: (val) => (val.length > 120 ? 'Keep the footer under 120 characters' : ''),
    cashierMaxDiscountPercent: (val) => {
      const n = Number(val);
      return String(val).trim() === '' || Number.isNaN(n) || n < 0 || n > 100 ? 'Enter 0 to 100' : '';
    },
    expiryAlertDays: (val) => (/^\d+$/.test(String(val).trim()) ? '' : 'Whole number of days'),
    autoLockMinutes: (val) => (/^\d+$/.test(String(val).trim()) ? '' : 'Whole number of minutes (0 = never)'),
  });

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    try {
      setIsSaving(true);
      const res = await api.saveSettings(formData);
      if (res.success) {
        showToast('Store settings saved', 'success');
        await refreshAllData();
      } else {
        showToast(res.error || 'Failed to save settings', 'error');
      }
    } catch {
      showToast('Error saving settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Store details, tax, receipts, POS rules and expense categories.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar" role="tablist">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          role="tab"
          aria-selected={activeTab === 'general'}
          className={`-mb-px h-10 px-3 text-[13px] font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-brand-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Store className="w-4 h-4" />
          Store & POS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          role="tab"
          aria-selected={activeTab === 'expenses'}
          className={`-mb-px h-10 px-3 text-[13px] font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'border-brand-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Tags className="w-4 h-4" />
          Expense categories
        </button>
      </div>

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <form ref={v.formRef} onSubmit={handleSaveGeneral} noValidate className="space-y-5 max-w-4xl">
          <FormErrorSummary validation={v} />
          <Card title="Store Identity & Contact Information">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Store name *"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  {...v.field('storeName')}
                />
                <Input
                  label="Tagline"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  optional
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Phone number"
                  type="tel"
                  inputMode="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="tabular"
                  hint="Printed on every receipt."
                  {...v.field('phone')}
                  isValid={false}
                />
                <Input
                  label="Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card title="Currency & Billing Parameters">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Currency code"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="PKR"
                />
                <Input
                  label="Currency symbol *"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="Rs."
                  {...v.field('currencySymbol')}
                  isValid={false}
                />
                <Input
                  label="Sales tax rate *"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  max="100"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  placeholder="0"
                  suffix="%"
                  className="tabular"
                  {...v.field('taxRate')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Default low-stock alert level"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={formData.lowStockDefaultThreshold}
                  onChange={(e) =>
                    setFormData({ ...formData, lowStockDefaultThreshold: e.target.value })
                  }
                  placeholder="5"
                  className="tabular"
                  {...v.field('lowStockDefaultThreshold')}
                />

                <Select
                  label="Selling with zero stock"
                  options={[
                    { value: 'false', label: 'Block (no sale when out of stock)' },
                    { value: 'true', label: 'Allow (stock can go negative)' },
                  ]}
                  value={formData.allowNegativeStock}
                  onChange={(e) =>
                    setFormData({ ...formData, allowNegativeStock: e.target.value })
                  }
                />
              </div>
            </div>
          </Card>

          <Card title="Receipt & Print Customization">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Receipt paper"
                  options={[
                    { value: 'thermal80', label: '80mm thermal (standard)' },
                    { value: 'thermal58', label: '58mm thermal (compact)' },
                    { value: 'a4', label: 'A4 full-page invoice' },
                  ]}
                  value={formData.receiptType}
                  onChange={(e) => setFormData({ ...formData, receiptType: e.target.value })}
                />

                <Input
                  label="Receipt footer"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  hint={`${formData.receiptFooter.length}/120 characters`}
                  {...v.field('receiptFooter')}
                  isValid={false}
                />
              </div>
            </div>
          </Card>

          <Card title="POS rules, security & tax registration">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Store time zone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                options={TIME_ZONES.map((z) => ({ value: z, label: z }))}
                hint="Used for invoice numbers, 'today' and all reports"
              />
              <Input
                label="Cashier max discount without PIN"
                type="number"
                min="0"
                max="100"
                suffix="%"
                value={formData.cashierMaxDiscountPercent}
                onChange={(e) => setFormData({ ...formData, cashierMaxDiscountPercent: e.target.value })}
                hint="Above this a manager PIN is required"
                {...v.field('cashierMaxDiscountPercent')}
              />
              <Input
                label="Expiry alert (days before)"
                type="number"
                min="0"
                value={formData.expiryAlertDays}
                onChange={(e) => setFormData({ ...formData, expiryAlertDays: e.target.value })}
                {...v.field('expiryAlertDays')}
              />
              <Input
                label="Auto lock after idle minutes"
                type="number"
                min="0"
                value={formData.autoLockMinutes}
                onChange={(e) => setFormData({ ...formData, autoLockMinutes: e.target.value })}
                hint="0 = never lock"
                {...v.field('autoLockMinutes')}
              />
              <Input label="NTN (printed on receipt)" value={formData.ntn} onChange={(e) => setFormData({ ...formData, ntn: e.target.value })} optional />
              <Input label="STRN (printed on receipt)" value={formData.strn} onChange={(e) => setFormData({ ...formData, strn: e.target.value })} optional />
            </div>
          </Card>

          <div className="sticky bottom-0 -mx-1 px-1 py-3 flex justify-end gap-3 bg-[#f5f5f2]/90 backdrop-blur-sm border-t border-slate-200">
            <Button type="submit" variant="primary" isLoading={isSaving} icon={Save}>
              Save settings
            </Button>
          </div>
        </form>
      )}

      {activeTab === 'expenses' && <ExpenseCategoriesSettings />}
    </div>
  );
}
