import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select, FieldLabel } from '../common/Input';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import { api } from '../../services/api';
import { ArrowLeftRight, ArrowRight, Plus, Minus, Equal } from 'lucide-react';

const REASON_OPTIONS = [
  { value: 'Inventory Audit Correction', label: 'Inventory audit correction' },
  { value: 'Damaged Goods / Spoilage', label: 'Damaged goods / spoilage' },
  { value: 'Expired Stock Discarded', label: 'Expired stock discarded' },
  { value: 'Supplier Direct Return', label: 'Returned to supplier' },
  { value: 'Customer Return Restock', label: 'Customer return restocked' },
  { value: 'Found Extra Inventory', label: 'Found extra inventory' },
  { value: 'Other Reason', label: 'Other reason' },
];

const ACTIONS = [
  { id: 'ADD', label: 'Add', Icon: Plus },
  { id: 'SUBTRACT', label: 'Deduct', Icon: Minus },
  { id: 'SET', label: 'Set exact', Icon: Equal },
];

export function StockAdjustModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}) {
  const { refreshAllData } = useStore();
  const { showToast } = useToast();

  const [adjustmentType, setAdjustmentType] = useState('ADD'); // 'ADD', 'SUBTRACT', 'SET'
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Inventory Audit Correction');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStock = Number(product?.currentStock) || 0;

  const v = useFormValidation(
    { quantity, customReason, adjustmentType, reason },
    {
      quantity: (val, all) => {
        if (String(val).trim() === '') return 'Enter a quantity';
        const n = Number(val);
        if (Number.isNaN(n)) return 'Numbers only';
        if (all.adjustmentType === 'SET') return n < 0 ? "Stock can't be negative" : '';
        if (n <= 0) return 'Quantity must be more than 0';
        if (all.adjustmentType === 'SUBTRACT' && n > currentStock) {
          return `Only ${currentStock} in stock. You can't deduct more than that.`;
        }
        return '';
      },
      customReason: (val, all) =>
        all.reason === 'Other Reason' && !val.trim() ? 'Describe the reason for this adjustment' : '',
    }
  );

  useEffect(() => {
    if (isOpen) {
      setAdjustmentType('ADD');
      setQuantity('');
      setReason('Inventory Audit Correction');
      setCustomReason('');
      v.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product?.productId]);

  if (!product) return null;

  const qtyNum = parseFloat(quantity) || 0;

  let projectedStock = currentStock;
  if (adjustmentType === 'ADD') projectedStock = currentStock + qtyNum;
  else if (adjustmentType === 'SUBTRACT') projectedStock = Math.max(0, currentStock - qtyNum);
  else if (adjustmentType === 'SET') projectedStock = qtyNum;

  const delta = projectedStock - currentStock;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;

    const finalReason = reason === 'Other Reason' ? customReason.trim() : reason;

    try {
      setIsSubmitting(true);
      const res = await api.adjustStock({
        productId: product.productId,
        adjustmentType,
        quantity: qtyNum,
        reason: finalReason,
        createdBy: 'Store Manager',
      });

      if (res.success) {
        showToast(`Stock for "${product.name}" is now ${projectedStock} ${product.unit}`, 'success');
        await refreshAllData();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.error || 'Failed to adjust stock', 'error');
      }
    } catch {
      showToast('Could not adjust stock. Check your connection and try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust stock"
      subtitle={`${product.name} · currently ${currentStock} ${product.unit}`}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="stock-adjust-form" variant="primary" isLoading={isSubmitting} icon={ArrowLeftRight}>
            Apply adjustment
          </Button>
        </>
      }
    >
      <form id="stock-adjust-form" ref={v.formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel label="Action" />
          <div className="grid grid-cols-3 p-1 gap-1 bg-slate-100 border border-slate-200 rounded-xl" role="radiogroup">
            {ACTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={adjustmentType === id}
                onClick={() => setAdjustmentType(id)}
                className={`h-8 inline-flex items-center justify-center gap-1.5 text-[13px] font-medium rounded-lg transition-all duration-150 ${
                  adjustmentType === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={adjustmentType === 'SET' ? 'New stock quantity *' : `Quantity to ${adjustmentType === 'ADD' ? 'add' : 'deduct'} *`}
          type="number"
          inputMode="decimal"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          suffix={product.unit}
          className="tabular"
          autoFocus
          {...v.field('quantity')}
        />

        <Select
          label="Reason *"
          options={REASON_OPTIONS}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {reason === 'Other Reason' && (
          <div className="animate-in fade-in slide-in-from-top-1">
            <Input
              label="Describe the reason *"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="e.g. Rats damaged two cartons"
              autoFocus
              {...v.field('customReason')}
            />
          </div>
        )}

        <div className="px-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[13px]">
          <span className="text-slate-500">After this change</span>
          <span className="flex items-center gap-2 tabular">
            <span className="text-slate-500">{currentStock}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span key={projectedStock} className="text-[15px] font-semibold text-slate-900 animate-bump inline-block">
              {projectedStock} {product.unit}
            </span>
            {delta !== 0 && (
              <span className={`text-xs font-medium ${delta > 0 ? 'text-brand-600' : 'text-rose-600'}`}>
                ({delta > 0 ? '+' : ''}
                {delta})
              </span>
            )}
          </span>
        </div>
      </form>
    </Modal>
  );
}
