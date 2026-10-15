import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { useFormValidation, rules } from '../hooks/useFormValidation';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import {
  Database,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Store,
  ShieldCheck,
  Server,
} from 'lucide-react';

export function Settings() {
  const { settings, isLiveBackend, refreshAllData } = useStore();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState('general'); // 'general', 'database', 'instructions'

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
  });

  // Google Apps Script Connection State
  const [appsScriptUrl, setAppsScriptUrl] = useState(api.getEndpointUrl() || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
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
  });

  const urlV = useFormValidation(
    { appsScriptUrl },
    {
      appsScriptUrl: (val) => {
        if (!val.trim()) return 'Paste your Apps Script web app URL';
        const urlError = rules.url(val);
        if (urlError) return urlError;
        return /script\.google(usercontent)?\.com/.test(val) && /\/exec\/?$/.test(val.trim())
          ? ''
          : 'Use the web app URL from script.google.com. It ends with /exec';
      },
    }
  );

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

  const handleTestConnection = async () => {
    if (!urlV.validate()) return;

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await api.testConnection(appsScriptUrl.trim());
      setTestResult(res);
      if (res.success) {
        showToast('Google Apps Script connection successful!', 'success');
      } else {
        showToast(res.error || 'Connection failed', 'error');
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      showToast('Connection error', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleApplyAppsScriptUrl = async () => {
    if (!urlV.validate()) return;
    api.setEndpointUrl(appsScriptUrl.trim());
    showToast('Apps Script endpoint updated', 'success');
    await refreshAllData();
  };

  const handleSwitchToLocal = () => {
    api.setForceLocal(true);
    showToast('Switched to Local Demo Mode', 'info');
    refreshAllData();
  };

  const handleSwitchToLive = () => {
    if (!urlV.validate()) return;
    api.setForceLocal(false);
    showToast('Switched to the live database', 'success');
    refreshAllData();
  };

  const handleResetDemoData = async () => {
    if (
      !(await confirm({
        title: 'Reset the demo database?',
        message: 'Local data is replaced with the original sample products, suppliers and customers.',
        confirmText: 'Reset demo data',
        tone: 'danger',
      }))
    ) {
      return;
    }
    api.resetLocalDatabase();
    showToast('Local database restored to fresh demo state', 'success');
    refreshAllData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Store details, tax, receipts and your database connection.
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
          onClick={() => setActiveTab('database')}
          role="tab"
          aria-selected={activeTab === 'database'}
          className={`-mb-px h-10 px-3 text-[13px] font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'database'
              ? 'border-brand-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          Database
          <span
            className={`w-2 h-2 rounded-full ${
              isLiveBackend ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('instructions')}
          role="tab"
          aria-selected={activeTab === 'instructions'}
          className={`-mb-px h-10 px-3 text-[13px] font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'instructions'
              ? 'border-brand-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Server className="w-4 h-4" />
          Setup guide
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

          <div className="sticky bottom-0 -mx-1 px-1 py-3 flex justify-end gap-3 bg-[#f5f5f2]/90 backdrop-blur-sm border-t border-slate-200">
            <Button type="submit" variant="primary" isLoading={isSaving} icon={Save}>
              Save settings
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: Database Integration */}
      {activeTab === 'database' && (
        <div className="space-y-6 max-w-4xl">
          <Card title="Google Sheets Backend Connection">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isLiveBackend ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800">
                      Active Backend Mode: {isLiveBackend ? 'Live Google Apps Script' : 'Local Demo Storage'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {isLiveBackend
                        ? 'Requests write directly to your Google Spreadsheet.'
                        : 'Using high-speed local mock storage preloaded with grocery items.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isLiveBackend ? (
                    <Button variant="outline" size="sm" onClick={handleSwitchToLocal}>
                      Switch to Local Mode
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={handleSwitchToLive}>
                      Switch to Live Backend
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Input
                  label="Apps Script web app URL"
                  value={appsScriptUrl}
                  onChange={(e) => {
                    setAppsScriptUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="https://script.google.com/macros/s/AKfycby.../exec"
                  hint="Apps Script > Deploy > Manage deployments > Web app URL"
                  className="font-mono text-[13px]"
                  {...urlV.field('appsScriptUrl')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  isLoading={isTesting}
                  icon={ShieldCheck}
                >
                  Test connection
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyAppsScriptUrl}
                  icon={Save}
                >
                  Save and connect
                </Button>
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {testResult.success
                        ? 'Connected Successfully to Google Apps Script!'
                        : 'Connection Test Failed'}
                    </p>
                    <p className="mt-0.5 font-normal">
                      {testResult.message || testResult.error}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Local Development Database Management">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-800">
                  Reset Local Sample Database
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Restores 28 sample Pakistani grocery items across 8 categories, demo suppliers, and test customers.
                </p>
              </div>
              <Button variant="danger-soft" size="sm" icon={RotateCcw} onClick={handleResetDemoData} className="shrink-0">
                Reset demo data
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Setup Guide */}
      {activeTab === 'instructions' && (
        <div className="space-y-4 max-w-4xl text-sm text-slate-700">
          <Card title="Google Sheets Setup & Deployment Instructions">
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 leading-relaxed">
                <li>
                  <strong>Create a new Google Sheet:</strong> Open{' '}
                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 underline font-semibold"
                  >
                    sheets.new
                  </a>{' '}
                  and name your spreadsheet <em>Grocery Store Database</em>.
                </li>
                <li>
                  <strong>Open Apps Script:</strong> In the Google Sheet top menu, click{' '}
                  <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.
                </li>
                <li>
                  <strong>Copy Backend Files:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1.5 space-y-1 text-slate-600">
                    <li>
                      In <code>Code.gs</code>, paste the contents of{' '}
                      <code>backend/Code.gs</code>
                    </li>
                    <li>
                      Create a script named <code>Setup</code>, paste{' '}
                      <code>backend/Setup.gs</code>
                    </li>
                    <li>
                      Create a script named <code>SeedData</code>, paste{' '}
                      <code>backend/SeedData.gs</code>
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>Initialize Sheets:</strong> In the Apps Script toolbar function dropdown,
                  select <code>setupDatabase</code> and click <strong>Run</strong>. Accept Google's
                  one-time authorization prompt. All 13 formatted sheets will be created automatically!
                </li>
                <li>
                  <strong>(Optional) Seed Demo Data:</strong> Run <code>seedDemoData</code> in Apps
                  Script to populate 28+ grocery items immediately.
                </li>
                <li>
                  <strong>Deploy as Web App:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1.5 space-y-1 text-slate-600">
                    <li>
                      Click <strong>Deploy</strong> &gt; <strong>New deployment</strong>
                    </li>
                    <li>
                      Select type: <strong>Web app</strong>
                    </li>
                    <li>
                      Execute as: <strong>Me</strong>
                    </li>
                    <li>
                      Who has access: <strong>Anyone</strong> (critical for browser fetch calls)
                    </li>
                    <li>Click <strong>Deploy</strong> and copy your Web App URL.</li>
                  </ul>
                </li>
                <li>
                  <strong>Connect:</strong> Paste the copied URL into the <em>Google Sheets Integration</em>{' '}
                  tab above and click <strong>Save & Connect Live URL</strong>!
                </li>
              </ol>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
