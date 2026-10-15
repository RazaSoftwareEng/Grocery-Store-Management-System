import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { Icon: CheckCircle2, icon: 'text-brand-600', bar: 'bg-brand-600', title: 'Done' },
  error: { Icon: AlertCircle, icon: 'text-rose-600', bar: 'bg-rose-600', title: 'Something went wrong' },
  warning: { Icon: AlertTriangle, icon: 'text-amber-600', bar: 'bg-amber-500', title: 'Heads up' },
  info: { Icon: Info, icon: 'text-info-600', bar: 'bg-info-500', title: 'Note' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 180);
  }, []);

  const showToast = useCallback(
    (message, type = 'success', duration = 4000) => {
      const id = Date.now() + Math.random().toString(36).slice(2, 6);
      setToasts((prev) => [...prev.slice(-3), { id, message, type, duration }]);
      if (duration > 0) setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  // Lets non-React utilities (e.g. CSV export) raise a toast
  useEffect(() => {
    const handler = (e) => showToast(e.detail?.message, e.detail?.type || 'info');
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-[360px] pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const s = STYLES[toast.type] || STYLES.success;
          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 py-3 pl-3.5 pr-2.5 rounded-xl bg-white border border-slate-200 shadow-xl text-[13px] leading-5 ${
                toast.leaving
                  ? 'animate-out fade-out slide-out-to-right-6'
                  : 'animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-300'
              }`}
            >
              <s.Icon className={`w-[18px] h-[18px] shrink-0 mt-px ${s.icon}`} strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{s.title}</p>
                <p className="text-slate-600 break-words">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {toast.duration > 0 && (
                <span
                  className={`absolute left-0 bottom-0 h-0.5 opacity-60 ${s.bar}`}
                  style={{ animation: `toast-timer ${toast.duration}ms linear forwards` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <style>{'@keyframes toast-timer{from{width:100%}to{width:0}}'}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
