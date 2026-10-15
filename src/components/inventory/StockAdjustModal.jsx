import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { ArrowLeftRight, AlertTriangle } from 'lucide-react';

const REASON_OPTIONS = [
  { value: 'Inventory Audit Correction', label: 'Inventory Audit Correction' },
  { value: 'Damaged Goods / Spoilage', label: 'Damaged Goods / Spoilage' },
  { value: 'Expired Stock Discarded', label: 'Expired Stock Discarded' },
  { value: 'Supplier Direct Return', label: 'Supplier Direct Return' },
  { value: 'Customer Return Restock', label: 'Customer Return Restock' },
  { value: 'Found Extra Inventory', label: 'Found Extra Inventory' },
  { value: 'Other Reason', label: 'Other Reason' },
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

  if (!product) return null;

  const currentStock = Number(product.currentStock) || 0;
  const qtyNum = parseFloat(quantity) || 0;

  let projectedStock = currentStock;
  if (adjustmentType === 'ADD') projectedStock = currentStock + qtyNum;
  else if (adjustmentType === 'SUBTRACT') projectedStock = Math.max(0, currentStock - qtyNum);
  else if (adjustmentType === 'SET') projectedStock = qtyNum;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (qtyNum <= 0) {
      showToast('Quantity must be greater than zero', 'warning');
      return;
    }

    if (adjustmentType === 'SUBTRACT' && qtyNum > currentStock) {
      showToast(`Cannot subtract more than current inventory (${currentStock})`, 'warning');
      return;
    }

    const finalReason = reason === 'Other Reason' ? customReason : reason;
    if (reason === 'Other Reason' && !customReason.trim()) {
      showToast('Please specify the reason for this adjustment', 'warning');
      return;
    }

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
        showToast('Stock adjusted and movement logged to Google Sheets', 'success');
        await refreshAllData();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.error || 'Failed to adjust stock', 'error');
      }
    } catch {
      showToast('Error adjusting stock', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Inventory Stock"
      subtitle={`Product: ${product.name} (Current: ${currentStock} ${product.unit})`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Adjustment Type Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1.5">
            Adjustment Action
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'ADD', label: 'Add Stock (+)' },
              { id: 'SUBTRACT', label: 'Deduct (-)' },
              { id: 'SET', label: 'Set Exact (=)' },
            ].map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => setAdjustmentType(act.id)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                  adjustmentType === act.id
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <Input
          label={
            adjustmentType === 'SET'
              ? 'New Absolute Stock Quantity *'
              : `Quantity to ${adjustmentType === 'ADD' ? 'Add' : 'Deduct'} *`
          }
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          required
          autoFocus
        />

        {/* Reason */}
        <Select
          label="Reason for Adjustment *"
          options={REASON_OPTIONS}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />

        {reason === 'Other Reason' && (
          <Input
            label="Specify Reason *"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Type reason here..."
            required
          />
        )}

        {/* Live Calculation Preview */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
          <span className="text-slate-600">Updated Stock will be:</span>
          <span className="text-sm font-black text-slate-900">
            {projectedStock} {product.unit}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            icon={ArrowLeftRight}
          >
            Apply Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
