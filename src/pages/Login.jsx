import React, { useState } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import {
  Store,
  Lock,
  User,
  ShieldCheck,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight
} from 'lucide-react';

export function Login() {
  const { login, quickLogin, isLoadingAuth } = useAuth();
  const { settings, isLiveBackend } = useStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Demo credentials only exist in Google Sheets / local demo mode, never in the Supabase database
  const showDemoLogins = api.backendName !== 'Supabase';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    const res = await login(username.trim(), password.trim());
    if (res.success) {
      if (res.user.role === 'CASHIER') {
        navigate('/pos');
      } else {
        navigate('/');
      }
    } else {
      setError(res.error || 'Invalid username or password');
    }
  };

  const handleQuick = async (role) => {
    setError('');
    const targetUser = role === 'admin' ? 'admin' : 'cashier1';
    const targetPass = role === 'admin' ? 'admin123' : '1234';
    setUsername(targetUser);
    setPassword(targetPass);

    const res = await quickLogin(role);
    if (res.success) {
      if (res.user.role === 'CASHIER') {
        navigate('/pos');
      } else {
        navigate('/');
      }
    } else {
      setError(res.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 p-6 text-white text-center relative">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <Store className="w-7 h-7 text-emerald-300" />
          </div>
          <h1 className="text-xl font-black tracking-tight">{settings.storeName || 'Bismillah Grocery'}</h1>
          <p className="text-xs text-emerald-200/80 mt-1">{settings.tagline || 'POS & Management System'}</p>

          {/* Backend Status Pill */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 text-[11px] font-semibold text-emerald-200">
            <span className={`w-2 h-2 rounded-full ${isLiveBackend ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <Database className="w-3 h-3" />
            <span>{isLiveBackend ? `Connected: ${api.backendName}` : 'Local Demo Mode'}</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">Sign in to your counter</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter your staff credentials or use 1-click login below</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username / Staff ID *"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or cashier1"
              autoFocus
              required
            />

            <Input
              label="Password / Security PIN *"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoadingAuth}
              icon={ArrowRight}
              className="w-full font-bold shadow-md text-sm mt-2"
            >
              Sign In to Counter
            </Button>

            {showDemoLogins && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <span className="font-bold text-slate-700">Manager:</span> <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-emerald-800 font-bold">admin</code> / <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-emerald-800 font-bold">admin123</code>
              </div>
              <div>
                <span className="font-bold text-slate-700">Cashier:</span> <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-teal-800 font-bold">cashier1</code> / <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-teal-800 font-bold">1234</code>
              </div>
            </div>
            )}
          </form>

          {/* Quick Demo Login Chips */}
          {showDemoLogins && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2.5">
              Instant 1-Click Fast Login
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuick('admin')}
                disabled={isLoadingAuth}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Store Manager</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Admin (Full Control)</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('cashier')}
                disabled={isLoadingAuth}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                  <ShoppingCart className="w-4 h-4 text-teal-600" />
                  <span>Counter Cashier</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">cashier1 (POS Billing)</p>
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-slate-400 mt-4 text-center relative z-10">
        Grocery Store Management System • Powered by {api.backendName}
      </p>
    </div>
  );
}
