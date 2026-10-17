import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useFormValidation } from '../hooks/useFormValidation';
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Barcode,
  BarChart3,
  Boxes,
} from 'lucide-react';

function readRememberedUsername() {
  try {
    return localStorage.getItem('gsms_remember_username') || '';
  } catch {
    return '';
  }
}

function hasLoggedInBefore() {
  try {
    return localStorage.getItem('gsms_session_only') !== null;
  } catch {
    return false;
  }
}

export function Login() {
  const { login, isLoadingAuth } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => ({ username: readRememberedUsername(), password: '' }));
  const [remember, setRemember] = useState(() => Boolean(readRememberedUsername()) || !hasLoggedInBefore());
  const [error, setError] = useState('');

  const v = useFormValidation(form, {
    username: (val) => (!val.trim() ? 'Enter your username or staff ID' : ''),
    password: (val) => (!val ? 'Enter your password or PIN' : ''),
  });

  const storeName = settings.storeName || 'Bismillah Grocery';

  const goHome = (user) => navigate(user.role === 'CASHIER' ? '/pos' : '/');

  const update = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!v.validate()) return;

    const res = await login(form.username.trim(), form.password.trim(), remember);
    if (res.success) {
      goHome(res.user);
    } else {
      setError(res.error || 'Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-[#f5f5f2]">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-10 bg-brand-800 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="w-9 h-9 rounded-xl bg-white text-brand-800 flex items-center justify-center font-semibold text-sm">
            {storeName.charAt(0)}
          </div>
          <span className="font-semibold">{storeName}</span>
        </div>

        <div className="relative max-w-md stagger">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Billing, stock and profit for your store, in one place.
          </h1>
          <ul className="mt-8 space-y-4 text-[15px] text-brand-100">
            <li className="flex items-center gap-3">
              <Barcode className="w-5 h-5 text-brand-300 shrink-0" strokeWidth={1.8} />
              Scan and bill in seconds at the counter
            </li>
            <li className="flex items-center gap-3">
              <Boxes className="w-5 h-5 text-brand-300 shrink-0" strokeWidth={1.8} />
              Low-stock alerts before shelves run empty
            </li>
            <li className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-brand-300 shrink-0" strokeWidth={1.8} />
              Daily sales and gross profit at a glance
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-brand-200">
          {settings.tagline || 'POS & management system'}
        </p>
      </aside>

      {/* Form */}
      <main className="flex flex-col items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-semibold text-sm">
              {storeName.charAt(0)}
            </div>
            <span className="font-semibold text-slate-900">{storeName}</span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1">Use your staff username and password or PIN.</p>


          {error && (
            <div
              role="alert"
              className="mt-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px] flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form ref={v.formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Input
              label="Username or staff ID *"
              icon={User}
              value={form.username}
              onChange={update('username')}
              placeholder="Your staff username"
              autoComplete="username"
              autoFocus
              {...v.field('username')}
            />

            <Input
              label="Password or PIN *"
              type="password"
              icon={Lock}
              value={form.password}
              onChange={update('password')}
              placeholder="Enter password"
              autoComplete="current-password"
              {...v.field('password')}
              isValid={false}
            />

            <label className="flex items-center gap-2 text-[13px] text-slate-700 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-brand-600"
              />
              Remember me on this computer
            </label>

            <Button type="submit" variant="primary" size="lg" isLoading={isLoadingAuth} className="w-full">
              Sign in
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>


          <p className="text-xs text-slate-400 mt-10">Grocery Store Management System</p>
        </div>
      </main>
    </div>
  );
}
