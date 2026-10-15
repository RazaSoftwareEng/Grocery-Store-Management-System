import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

const ConfirmContext = createContext(null);

/**
 * Promise-based replacement for window.confirm():
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, message, confirmText, tone: 'danger' }))) return;
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ isOpen: false });
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ isOpen: true, ...opts });
    });
  }, []);

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        isOpen={state.isOpen}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        tone={state.tone}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
