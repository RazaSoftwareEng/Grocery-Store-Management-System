import React, { useEffect, useRef, useState } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Button } from './Button';
import { Input } from './Input';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'wheel', 'mousemove'];

/** Locks the screen after `autoLockMinutes` without input; unlock with your own password. */
export function IdleLock() {
  const { isAuthenticated, isLocked, lock } = useAuth();
  const { settings } = useStore();
  const minutes = Number(settings.autoLockMinutes) || 0;
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    if (!isAuthenticated || isLocked || minutes <= 0) return undefined;
    lastActivity.current = Date.now();
    const mark = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, mark, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > minutes * 60000) lock();
    }, 15000);
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, mark));
      clearInterval(timer);
    };
  }, [isAuthenticated, isLocked, minutes, lock]);

  return isAuthenticated && isLocked ? <LockScreen /> : null;
}

function LockScreen() {
  const { currentUser, unlock, logout } = useAuth();
  const { settings } = useStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setIsChecking(true);
    const res = await unlock(password);
    setIsChecking(false);
    if (!res.success) {
      setError(res.error || 'Wrong password');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-brand-900/95 backdrop-blur-sm flex items-center justify-center p-5">
      <form onSubmit={submit} className="w-full max-w-[360px] bg-white rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Screen locked</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          {settings.storeName} · {currentUser?.fullName || currentUser?.username}. Enter your password to continue.
        </p>
        <Input
          type="password"
          label="Password"
          containerClassName="mt-4"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          error={error}
          autoFocus
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full mt-4" isLoading={isChecking}>
          Unlock
        </Button>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} className="mt-3">
          Sign in as someone else
        </Button>
      </form>
    </div>
  );
}
