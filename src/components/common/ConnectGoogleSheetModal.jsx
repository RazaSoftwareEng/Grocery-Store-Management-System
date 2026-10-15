import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Save,
  RotateCcw,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  HelpCircle,
  FileCode,
  Globe
} from 'lucide-react';

export function ConnectGoogleSheetModal({ isOpen, onClose }) {
  const { isLiveBackend, refreshAllData } = useStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'guide' | 'scripts'
  const [appsScriptUrl, setAppsScriptUrl] = useState(api.getEndpointUrl() || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedScript, setCopiedScript] = useState('');

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
        showToast('Google Apps Script connection verified successfully!', 'success');
      } else {
        showToast(res.error || 'Connection failed', 'error');
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      showToast('Connection test error', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndConnect = async () => {
    if (!appsScriptUrl.trim()) {
      showToast('Please enter your Google Apps Script Web App URL', 'warning');
      return;
    }

    try {
      setIsSaving(true);
      api.setEndpointUrl(appsScriptUrl.trim());
      api.setForceLocal(false);
      await refreshAllData();
      showToast('Google Sheets connected as live backend database!', 'success');
      onClose();
    } catch (err) {
      showToast(`Error connecting: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchToLocal = async () => {
    api.setForceLocal(true);
    showToast('Switched to Local Demo Mode', 'info');
    await refreshAllData();
  };

  const handleClearDummyData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to remove all dummy/sample products, categories, and sales? This will leave your inventory empty (0 items) so you can manage your own real store products.'
    );
    if (!confirmed) return;

    api.clearAllDummyData();
    await refreshAllData();
    showToast('All dummy data cleared! Store catalog is now completely empty.', 'success');
  };

  const handleRestoreDemoData = async () => {
    const confirmed = window.confirm(
      'Restore sample Pakistani grocery items (28 products, 8 categories, demo suppliers)?'
    );
    if (!confirmed) return;

    api.resetLocalDatabase();
    await refreshAllData();
    showToast('Sample demo catalog restored.', 'success');
  };

  const copyToClipboard = (text, scriptName) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(scriptName);
    showToast(`Copied ${scriptName} to clipboard!`, 'success');
    setTimeout(() => setCopiedScript(''), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Sheets Database Connection"
      subtitle="Connect your Google Sheet backend or manage store sample data"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('connect')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'connect'
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Database className="w-4 h-4" />
            Connect Web App
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Setup Guide (Roman Urdu &amp; English)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scripts')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'scripts'
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Backend Scripts
          </button>
        </div>

        {/* TAB 1: CONNECT */}
        {activeTab === 'connect' && (
          <div className="space-y-4">
            {/* Status Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isLiveBackend
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    isLiveBackend ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {isLiveBackend ? '🟢 Connected: Google Sheets Backend' : '⚡ Local Demo Storage Mode'}
                  </h4>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {isLiveBackend
                      ? 'Live CRUD: Sales, Products, Stock, and Expenses are writing to your Google Sheet.'
                      : 'Running locally in your browser. Connect Google Sheets below to save data to the cloud.'}
                  </p>
                </div>
              </div>

              {isLiveBackend && (
                <Button variant="outline" size="xs" onClick={handleSwitchToLocal} className="shrink-0">
                  Switch to Local Mode
                </Button>
              )}
            </div>

            {/* Input URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Google Apps Script Web App URL:
              </label>
              <Input
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycby.../exec"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-slate-400">
                Google Sheets &gt; Extensions &gt; Apps Script &gt; Deploy &gt; Manage deployments &gt; Web app URL
              </p>
            </div>

            {/* Actions: Test & Connect */}
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
                onClick={handleSaveAndConnect}
                isLoading={isSaving}
                icon={Save}
                className="font-bold shadow-xs"
              >
                Save & Connect Live URL
              </Button>
            </div>

            {/* Test Connection Results */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
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
                      ? 'Connection Verified! Google Sheets is ready.'
                      : 'Connection Failed'}
                  </p>
                  <p className="mt-0.5 text-[11px] opacity-90">
                    {testResult.message || testResult.error}
                  </p>
                </div>
              </div>
            )}

            {/* Dummy Data Removal Section */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Catalog & Sample Data Management
              </h4>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Empty Catalog (Remove Dummy Data)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Delete all preloaded sample products and categories to start with 0 items for your real store.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="danger"
                    size="xs"
                    icon={Trash2}
                    onClick={handleClearDummyData}
                    className="font-bold"
                  >
                    Clear Dummy Data
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    icon={RotateCcw}
                    onClick={handleRestoreDemoData}
                    className="text-slate-600"
                    title="Restore demo items"
                  >
                    Restore Samples
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STEP-BY-STEP SETUP GUIDE */}
        {activeTab === 'guide' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
            {/* Roman Urdu Summary Box */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-1.5">
              <h4 className="font-bold text-sm text-emerald-900">
                Google Sheet Connect Karne Ka Asaan Tareeqa (Roman Urdu Guide)
              </h4>
              <p className="text-xs leading-relaxed">
                1. <strong>sheets.new</strong> open karein aur sheet ka naam <strong>Grocery Store Database</strong> rakhein.<br />
                2. Upar menu mein <strong>Extensions &gt; Apps Script</strong> par click karein.<br />
                3. Project ke <strong>backend/Code.gs</strong> aur <strong>backend/Setup.gs</strong> ka code copy karke wahan paste karein.<br />
                4. Apps Script toolbar mein function <strong>setupDatabase</strong> select karke <strong>Run</strong> button dabayein. Iss se 13 sheets auto ban jayengi.<br />
                5. <strong>Deploy &gt; New deployment &gt; Web app</strong> par click karein. <strong>Who has access: Anyone</strong> lazmi set karein aur <strong>Deploy</strong> karein.<br />
                6. Web App URL copy karein aur yahan <strong>Connect Web App</strong> tab mein paste karke <strong>Save &amp; Connect</strong> daba dein!
              </p>
            </div>

            {/* Detailed English Steps */}
            <div className="space-y-3 pt-2 text-slate-700">
              <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <div>
                  <h5 className="font-bold text-slate-900">Create New Google Sheet</h5>
                  <p className="text-slate-600 mt-0.5">
                    Open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">sheets.new</a> in your browser. Name the sheet <em>Grocery Store Database</em>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <div>
                  <h5 className="font-bold text-slate-900">Open Apps Script Editor</h5>
                  <p className="text-slate-600 mt-0.5">
                    In Google Sheets menu bar, click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <div>
                  <h5 className="font-bold text-slate-900">Paste Backend Code</h5>
                  <p className="text-slate-600 mt-0.5">
                    Copy the contents of <code className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">backend/Code.gs</code> and paste it into <code className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">Code.gs</code>. Then click <strong>+</strong> &gt; <strong>Script</strong>, name it <code className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">Setup</code>, and paste the contents of <code className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">backend/Setup.gs</code>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  4
                </span>
                <div>
                  <h5 className="font-bold text-slate-900">Run setupDatabase</h5>
                  <p className="text-slate-600 mt-0.5">
                    In the Apps Script toolbar function dropdown, select <strong>setupDatabase</strong> and click <strong>Run</strong>. Accept Google's authorization prompt (Advanced &gt; Go to Untitled project). All 13 sheets with green header styling will be created immediately with zero dummy items.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  5
                </span>
                <div>
                  <h5 className="font-bold text-slate-900">Deploy as Web App</h5>
                  <p className="text-slate-600 mt-0.5">
                    Click <strong>Deploy</strong> (top right) &gt; <strong>New deployment</strong>.
                    <br />• Select Type: <strong>Web app</strong>
                    <br />• Description: <em>Grocery API v1</em>
                    <br />• Execute as: <strong>Me</strong>
                    <br />• Who has access: <strong>Anyone</strong> (crucial for web app connectivity)
                    <br />Click <strong>Deploy</strong> and copy the generated <strong>Web app URL</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  6
                </span>
                <div>
                  <h5 className="font-bold text-slate-900">Paste & Connect</h5>
                  <p className="text-slate-600 mt-0.5">
                    Paste the Web App URL in the <strong>Connect Web App</strong> tab and click <strong>Save & Connect Live URL</strong>. That is it! All your Add, Update, and Delete operations will now sync directly to your Google Sheet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BACKEND SCRIPTS */}
        {activeTab === 'scripts' && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              The backend scripts are located inside the <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-semibold">backend/</code> folder of this project:
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 font-mono">backend/Code.gs</span>
                  <p className="text-[11px] text-slate-500">Core API: POS Sales, Inventory, Customers, Expenses, Concurrency Locks</p>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">~1,500 lines</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 font-mono">backend/Setup.gs</span>
                  <p className="text-[11px] text-slate-500">Schema Initialization: Creates 13 clean sheets with zero dummy items</p>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">142 lines</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 font-mono">backend/SeedData.gs</span>
                  <p className="text-[11px] text-slate-500">Optional demo data: 28 sample Pakistani grocery items (only if you want samples)</p>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">146 lines</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
