import React, { useState } from 'react';
import { Banknote, LockOpen } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { api } from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

/** Shown instead of the POS until the cashier opens a cash drawer shift */
export function OpenShiftPanel({ compact = false }) {
  const { currencySymbol, refreshShift } = useStore();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [openingCash, setOpeningCash] = useState('');
  const [error, setError] = useState('');
  const [isOpening, setIsOpening] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(openingCash);
    if (openingCash.trim() === '' || Number.isNaN(n) || n < 0) {
      setError('Count the cash in the drawer and enter it (0 if empty)');
      return;
    }
    setIsOpening(true);
    const res = await api.openShift(n);
    setIsOpening(false);
    if (res.success) {
      showToast('Shift opened. You can start billing.', 'success');
      refreshShift();
    } else {
      setError(res.error || 'Could not open the shift');
    }
  };

  return (
    <div className={compact ? '' : 'flex-1 flex items-center justify-center p-4'}>
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xs p-6 animate-in fade-in"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
          <Banknote className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Open your shift</h2>
        <p className="text-[13px] text-slate-500 mt-1">
          {currentUser?.fullName || currentUser?.username}, count the cash in the drawer before the first bill.
        </p>
        <Input
          label="Opening cash *"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={openingCash}
          onChange={(e) => {
            setOpeningCash(e.target.value);
            setError('');
          }}
          suffix={currencySymbol}
          error={error}
          containerClassName="mt-4"
          className="tabular text-base font-semibold"
          autoFocus
        />
        <Button type="submit" icon={LockOpen} isLoading={isOpening} className="w-full mt-4">
          Open shift
        </Button>
      </form>
    </div>
  );
}
