import React, { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import { Button } from './Button';
import { Input } from './Input';

/** Full-screen "set a new password" step shown when must_change_password is true */
export function ChangePasswordScreen() {
  const { currentUser, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-[#f5f5f2]">
      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-slate-200 shadow-xs p-6 animate-in fade-in slide-in-from-bottom-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>
        <p className="text-sm text-slate-500 mt-1">
          Hi {currentUser?.fullName || currentUser?.username}. Your password was set by the store manager or is the
          default one. Choose your own password to continue.
        </p>
        <ChangePasswordForm className="mt-5" />
        <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} className="mt-4">
          Sign out instead
        </Button>
      </div>
    </div>
  );
}

export function ChangePasswordForm({ className = '', onDone }) {
  const { changePassword } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const v = useFormValidation(form, {
    oldPassword: (val) => (!val ? 'Enter your current password' : ''),
    newPassword: (val, all) => {
      if (val.length < 6) return 'At least 6 characters';
      return val === all.oldPassword ? 'Must be different from the current password' : '';
    },
    confirm: (val, all) => (val !== all.newPassword ? 'Passwords do not match' : ''),
  });

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    setIsSaving(true);
    const res = await changePassword(form.oldPassword, form.newPassword);
    setIsSaving(false);
    if (res.success) {
      showToast('Password changed', 'success');
      setForm({ oldPassword: '', newPassword: '', confirm: '' });
      v.reset();
      onDone?.();
    } else {
      setError(res.error || 'Could not change the password');
    }
  };

  return (
    <form ref={v.formRef} onSubmit={submit} noValidate className={`space-y-3 ${className}`}>
      {error && <p role="alert" className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
      <Input label="Current password *" type="password" autoComplete="current-password" value={form.oldPassword} onChange={set('oldPassword')} {...v.field('oldPassword')} isValid={false} autoFocus />
      <Input label="New password *" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} hint="At least 6 characters" {...v.field('newPassword')} />
      <Input label="Repeat new password *" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} {...v.field('confirm')} />
      <Button type="submit" isLoading={isSaving} className="w-full">
        Save new password
      </Button>
    </form>
  );
}
