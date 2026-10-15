import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import {
  Settings as SettingsIcon,
  Database,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  RotateCcw,
  Store,
  Printer,
  ShieldCheck,
  Server
} from 'lucide-react';

export function Settings() {
  const { settings, isLiveBackend, refreshAllData } = useStore();
  const { showToast } = useToast();

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

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await api.saveSettings(formData);
      if (res.success) {
        showToast('Store settings saved successfully', 'success');
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
    if (!appsScriptUrl.trim()) {
      showToast('Please enter a Google Apps Script Web App URL first', 'warning');
      return;
    }

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
    if (!appsScriptUrl.trim()) {
      showToast('Please enter an Apps Script URL first', 'warning');
      return;
    }
    api.setForceLocal(false);
    showToast('Switched to Live Google Sheets Backend', 'success');
    refreshAllData();
  };

  const handleResetDemoData = () => {
    if (
      !window.confirm(
        'Reset local demo database to initial sample grocery products, suppliers, and customers?'
      )
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
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Settings & Database</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure store details, tax rates, receipt formatting, and manage Google Sheets backend integration.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'general'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="w-4 h-4" />
          Store Profile & POS Settings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('database')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'database'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Google Sheets Integration
          <span
            className={`w-2 h-2 rounded-full ${
              isLiveBackend ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('instructions')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'instructions'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server className="w-4 h-4" />
          Apps Script Setup Guide
        </button>
      </div>

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-4xl">
          <Card title="Store Identity & Contact Information">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Store Name *"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  required
                />
                <Input
                  label="Store Tagline / Subtitle"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Contact Phone Number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="Store Address"
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
                  label="Currency Code"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="PKR"
                />
                <Input
                  label="Currency Symbol"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="Rs."
                />
                <Input
                  label="Sales Tax Rate (%)"
                  type="number"
                  step="any"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Default Low Stock Threshold"
                  type="number"
                  value={formData.lowStockDefaultThreshold}
                  onChange={(e) =>
                    setFormData({ ...formData, lowStockDefaultThreshold: e.target.value })
                  }
                  placeholder="5"
                />

                <Select
                  label="Allow Negative Stock Selling"
                  options={[
                    { value: 'false', label: 'Strict (Prevent checkout if out of stock)' },
                    { value: 'true', label: 'Allow (Permit negative inventory counts)' },
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
                  label="Default Printer Paper Format"
                  options={[
                    { value: 'thermal80', label: '80mm Thermal Receipt (Standard Retail)' },
                    { value: 'thermal58', label: '58mm Thermal Receipt (Compact)' },
                    { value: 'a4', label: 'Standard A4 Full Page Invoice' },
                  ]}
                  value={formData.receiptType}
                  onChange={(e) => setFormData({ ...formData, receiptType: e.target.value })}
                />

                <Input
                  label="Receipt Footer Thank You Message"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit" variant="primary" size="md" isLoading={isSaving} icon={Save} className="font-bold">
              Save Store Configuration
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: Database Integration */}
      {activeTab === 'database' && (
        <div className="space-y-6 max-w-4xl">
          <Card title="Google Sheets Backend Connection">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isLiveBackend ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Active Backend Mode: {isLiveBackend ? 'Live Google Apps Script' : 'Local Demo Storage'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
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
                  label="Google Apps Script Web App Deployment URL"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycby.../exec"
                  hint="Get this from Google Apps Script > Deploy > Manage deployments > Web app URL"
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
                  Test Connection
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyAppsScriptUrl}
                  icon={Save}
                  className="font-bold"
                >
                  Save & Connect Live URL
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
                    <p className="font-bold">
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
                <h4 className="text-xs font-bold text-slate-800">
                  Reset Local Sample Database
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Restores 28 sample Pakistani grocery items across 8 categories, demo suppliers, and test customers.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={handleResetDemoData}
                className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                Reset Demo Data
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Setup Guide */}
      {activeTab === 'instructions' && (
        <div className="space-y-4 max-w-4xl text-xs text-slate-700">
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
