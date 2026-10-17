import React, { useEffect, useState } from 'react';
import { Play, Trash2, ListRestart } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { EmptyState } from '../common/Table';
import { api } from '../../services/api';
import { formatDate, formatCurrency, round2 } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export function HeldBillsModal({ isOpen, onClose, onResume, hasCurrentCart, onChanged }) {
  const { products, currencySymbol } = useStore();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    const res = await api.getHeldBills();
    setIsLoading(false);
    if (res.success) setBills(res.data);
    else showToast(res.error || 'Could not load held bills', 'error');
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const priceOf = (productId) => Number(products.find((p) => p.productId === productId)?.sellingPrice) || 0;
  const estimate = (bill) =>
    round2((bill.cart || []).reduce((s, i) => s + priceOf(i.productId) * i.quantity - (i.discount || 0), 0) - (bill.billDiscount || 0));

  const resume = async (bill) => {
    if (hasCurrentCart && !(await confirm({
      title: 'Replace the current bill?',
      message: 'The items on the current bill will be removed. Hold it first if you need it.',
      confirmText: 'Replace',
    }))) return;
    const res = await api.deleteHeldBill(bill.holdId);
    if (!res.success) {
      showToast(res.error || 'Could not resume', 'error');
      return;
    }
    onResume(bill);
    onChanged?.();
  };

  const remove = async (bill) => {
    if (!(await confirm({ title: 'Delete this held bill?', confirmText: 'Delete', tone: 'danger' }))) return;
    const res = await api.deleteHeldBill(bill.holdId);
    if (res.success) {
      setBills((prev) => prev.filter((b) => b.holdId !== bill.holdId));
      onChanged?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Held bills" subtitle="Bills put aside at this counter" maxWidth="max-w-lg">
      {bills.length === 0 && !isLoading ? (
        <EmptyState icon={ListRestart} title="No held bills" description='Use "Hold" on the bill to park it and serve the next customer.' />
      ) : (
        <div className="space-y-2">
          {bills.map((b) => (
            <div key={b.holdId} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-900 truncate">
                  {b.note || b.customer?.name || 'Held bill'}
                </p>
                <p className="text-xs text-slate-500 tabular">
                  {(b.cart || []).length} items · about {formatCurrency(estimate(b), currencySymbol)} · {formatDate(b.createdAt)}
                </p>
              </div>
              <Button size="sm" icon={Play} onClick={() => resume(b)}>
                Resume
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(b)} aria-label="Delete held bill" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
